import type React from 'react';
import { DepthColorMap, DepthMapData, Point2D } from '../types';

/**
 * Color map interpolation functions
 */
function interpolateColor(
  t: number,
  stops: Array<{ p: number; r: number; g: number; b: number }>
): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const s0 = stops[i];
    const s1 = stops[i + 1];
    if (clamped >= s0.p && clamped <= s1.p) {
      const f = (clamped - s0.p) / (s1.p - s0.p || 0.0001);
      const r = Math.round(s0.r + (s1.r - s0.r) * f);
      const g = Math.round(s0.g + (s1.g - s0.g) * f);
      const b = Math.round(s0.b + (s1.b - s0.b) * f);
      return [r, g, b];
    }
  }
  const last = stops[stops.length - 1];
  return [last.r, last.g, last.b];
}

// Turbo Color Map (Near = Red/Warm, Far = Blue/Purple)
const TURBO_STOPS = [
  { p: 0.0, r: 215, g: 48, b: 39 },   // Closest (Near): Deep Red
  { p: 0.2, r: 252, g: 141, b: 89 },  // Orange
  { p: 0.4, r: 254, g: 224, b: 144 }, // Yellow
  { p: 0.6, r: 145, g: 191, b: 219 }, // Cyan / Light Blue
  { p: 0.8, r: 69, g: 117, b: 180 },  // Blue
  { p: 1.0, r: 49, g: 54, b: 149 },   // Furthest (Far): Deep Indigo
];

// Inferno Color Map (Near = Bright Yellow/Orange, Far = Dark Purple/Black)
const INFERNO_STOPS = [
  { p: 0.0, r: 252, g: 255, b: 164 }, // Near: Bright Yellow
  { p: 0.25, r: 249, g: 142, b: 9 },  // Orange
  { p: 0.5, r: 187, g: 55, b: 84 },   // Crimson
  { p: 0.75, r: 87, g: 16, b: 110 },  // Violet
  { p: 1.0, r: 0, g: 0, b: 4 },       // Far: Deep Black
];

// Viridis Color Map (Near = Yellow, Far = Deep Violet)
const VIRIDIS_STOPS = [
  { p: 0.0, r: 253, g: 231, b: 37 },  // Near: Yellow
  { p: 0.33, r: 53, g: 183, b: 121 }, // Green
  { p: 0.66, r: 49, g: 104, b: 142 }, // Teal/Blue
  { p: 1.0, r: 68, g: 1, b: 84 },     // Far: Dark Violet
];

// Spectral (Near = Red, Mid = Green, Far = Blue)
const SPECTRAL_STOPS = [
  { p: 0.0, r: 213, g: 62, b: 79 },
  { p: 0.25, r: 253, g: 174, b: 97 },
  { p: 0.5, r: 230, g: 245, b: 152 },
  { p: 0.75, r: 102, g: 194, b: 165 },
  { p: 1.0, r: 50, g: 136, b: 189 },
];

/**
 * Generate monocular depth map from an HTMLImageElement
 * Monocular relative depth: 0.0 = closest (near), 1.0 = furthest (far)
 */
export async function computeMonocularDepth(img: HTMLImageElement): Promise<DepthMapData> {
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;

  // Render to offscreen canvas for pixel extraction
  // Downsample slightly if ultra-high res for 60fps processing, while maintaining high detail
  const maxDim = 800;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  const procW = Math.round(width * scale);
  const procH = Math.round(height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = procW;
  canvas.height = procH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, procW, procH);

  const imgData = ctx.getImageData(0, 0, procW, procH);
  const src = imgData.data;
  const numPixels = procW * procH;

  // Convert to luminance & high-frequency edge map
  const luminance = new Float32Array(numPixels);
  for (let i = 0; i < numPixels; i++) {
    const idx = i * 4;
    const r = src[idx];
    const g = src[idx + 1];
    const b = src[idx + 2];
    luminance[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;
  }

  // Sobel edge & detail operator
  const edges = new Float32Array(numPixels);
  for (let y = 1; y < procH - 1; y++) {
    for (let x = 1; x < procW - 1; x++) {
      const idx = y * procW + x;
      const gx =
        -1 * luminance[(y - 1) * procW + (x - 1)] +
        1 * luminance[(y - 1) * procW + (x + 1)] +
        -2 * luminance[y * procW + (x - 1)] +
        2 * luminance[y * procW + (x + 1)] +
        -1 * luminance[(y + 1) * procW + (x - 1)] +
        1 * luminance[(y + 1) * procW + (x + 1)];

      const gy =
        -1 * luminance[(y - 1) * procW + (x - 1)] +
        -2 * luminance[(y - 1) * procW + x] +
        -1 * luminance[(y - 1) * procW + (x + 1)] +
        1 * luminance[(y + 1) * procW + (x - 1)] +
        2 * luminance[(y + 1) * procW + x] +
        1 * luminance[(y + 1) * procW + (x + 1)];

      edges[idx] = Math.min(1.0, Math.sqrt(gx * gx + gy * gy) * 1.5);
    }
  }

  // Multi-pass Monocular Depth synthesis (0.0 = Near, 1.0 = Far)
  // Incorporates ground perspective cue, atmospheric luminance falloff,
  // edge occlusion boundaries, and center-weighted subject saliency
  const rawDepth = new Float32Array(numPixels);

  for (let y = 0; y < procH; y++) {
    const normY = y / procH; // 0 (top) to 1 (bottom)
    // Perspective ground plane cue: bottom of image is generally closer
    const perspectiveGround = (1.0 - normY) * 0.75;

    for (let x = 0; x < procW; x++) {
      const idx = y * procW + x;
      const normX = x / procW;
      const distFromCenter = Math.sqrt(
        Math.pow(normX - 0.5, 2) + Math.pow(normY - 0.55, 2)
      );

      const lum = luminance[idx];
      const edge = edges[idx];

      // Saliency: high edge detail often belongs to foreground objects
      const saliencyNear = edge * 0.35;
      // Dark/shadow regions vs high-contrast foreground
      const contrastFactor = Math.abs(lum - 0.5) * 0.2;

      // Combine depth cues
      let d = perspectiveGround - saliencyNear - contrastFactor * 0.5 + distFromCenter * 0.15;

      // Adjust based on luminance (atmospheric haze: far objects often have lower contrast/higher haze)
      if (normY < 0.45) {
        d += (1.0 - lum * 0.3) * 0.2;
      }

      rawDepth[idx] = d;
    }
  }

  // Smooth diffusion filter (bilateral-like spatial smoothing)
  const smoothedDepth = new Float32Array(numPixels);
  const radius = 2;
  for (let y = 0; y < procH; y++) {
    for (let x = 0; x < procW; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= procH) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= procW) continue;
          sum += rawDepth[ny * procW + nx];
          count++;
        }
      }
      smoothedDepth[y * procW + x] = sum / count;
    }
  }

  // Normalize depth matrix to [0.0, 1.0] (0 = closest/near, 1 = furthest/far)
  let minD = Infinity;
  let maxD = -Infinity;
  for (let i = 0; i < numPixels; i++) {
    const val = smoothedDepth[i];
    if (val < minD) minD = val;
    if (val > maxD) maxD = val;
  }
  const range = maxD - minD || 1.0;

  const depthMatrix = new Float32Array(numPixels);
  for (let i = 0; i < numPixels; i++) {
    depthMatrix[i] = (smoothedDepth[i] - minD) / range;
  }

  // Render standard grayscale depth canvas (Near = Bright White 255, Far = Dark 0)
  const outImgData = ctx.createImageData(procW, procH);
  for (let i = 0; i < numPixels; i++) {
    // Standard depth map visual: near objects are white (1 - d), far are black
    const gray = Math.round((1.0 - depthMatrix[i]) * 255);
    const pIdx = i * 4;
    outImgData.data[pIdx] = gray;
    outImgData.data[pIdx + 1] = gray;
    outImgData.data[pIdx + 2] = gray;
    outImgData.data[pIdx + 3] = 255;
  }
  ctx.putImageData(outImgData, 0, 0);

  return {
    width: procW,
    height: procH,
    depthMatrix,
    canvas,
    dataUrl: canvas.toDataURL('image/png'),
  };
}

/**
 * Render depth map with specific color map and depth lens slicing
 * @param depthData Depth map data
 * @param colorMap Grayscale, Turbo, Inferno, Viridis, Spectral, Inverted
 * @param lensPosition 0.0 to 1.0 (Depth Lens slider)
 * @param lensEnabled whether depth lens highlight/filter is active
 */
export function renderDepthVisualization(
  depthData: DepthMapData,
  colorMap: DepthColorMap = 'turbo',
  lensPosition: number = 0.5,
  lensEnabled: boolean = false
): string {
  const { width, height, depthMatrix } = depthData;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  const numPixels = width * height;
  const lensBand = 0.12; // depth slice window (+- 12%)

  for (let i = 0; i < numPixels; i++) {
    const rawD = depthMatrix[i]; // 0.0 (near) to 1.0 (far)
    let r = 0, g = 0, b = 0;

    if (colorMap === 'grayscale') {
      // Near = Bright (255), Far = Dark (0)
      const val = Math.round((1.0 - rawD) * 255);
      r = val; g = val; b = val;
    } else if (colorMap === 'inverted') {
      // Near = Dark (0), Far = Bright (255)
      const val = Math.round(rawD * 255);
      r = val; g = val; b = val;
    } else if (colorMap === 'turbo') {
      [r, g, b] = interpolateColor(rawD, TURBO_STOPS);
    } else if (colorMap === 'inferno') {
      [r, g, b] = interpolateColor(rawD, INFERNO_STOPS);
    } else if (colorMap === 'viridis') {
      [r, g, b] = interpolateColor(rawD, VIRIDIS_STOPS);
    } else if (colorMap === 'spectral') {
      [r, g, b] = interpolateColor(rawD, SPECTRAL_STOPS);
    }

    // Apply Depth Lens highlighting if enabled
    if (lensEnabled) {
      const distFromLens = Math.abs(rawD - lensPosition);
      if (distFromLens < lensBand) {
        // Highlight active slice with glowing pulse
        const intensity = 1.0 - distFromLens / lensBand;
        r = Math.min(255, Math.round(r * 1.3 + intensity * 60));
        g = Math.min(255, Math.round(g * 1.3 + intensity * 60));
        b = Math.min(255, Math.round(b * 1.4 + intensity * 80));
      } else {
        // Dim and slightly desaturate out-of-focus depth bands
        const dimFactor = Math.max(0.2, 1.0 - (distFromLens - lensBand) * 1.8);
        const grayVal = 0.299 * r + 0.587 * g + 0.114 * b;
        r = Math.round((r * 0.4 + grayVal * 0.6) * dimFactor);
        g = Math.round((g * 0.4 + grayVal * 0.6) * dimFactor);
        b = Math.round((b * 0.4 + grayVal * 0.6) * dimFactor);
      }
    }

    const pIdx = i * 4;
    data[pIdx] = r;
    data[pIdx + 1] = g;
    data[pIdx + 2] = b;
    data[pIdx + 3] = 255;
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * Coordinate mapping helper: Maps a click on a displayed HTML element back to the original image coordinates
 */
export function getOriginalImageCoordinates(
  event: React.MouseEvent<HTMLElement> | MouseEvent,
  containerElement: HTMLElement,
  originalWidth: number,
  originalHeight: number
): Point2D {
  const rect = containerElement.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const clickY = event.clientY - rect.top;

  const containerW = rect.width;
  const containerH = rect.height;

  // If container matches image aspect ratio exactly
  const imageAspect = originalWidth / originalHeight;
  const containerAspect = containerW / containerH;

  let renderedW = containerW;
  let renderedH = containerH;
  let offsetX = 0;
  let offsetY = 0;

  if (containerAspect > imageAspect) {
    // Letterbox on left/right
    renderedH = containerH;
    renderedW = containerH * imageAspect;
    offsetX = (containerW - renderedW) / 2;
  } else {
    // Letterbox on top/bottom
    renderedW = containerW;
    renderedH = containerW / imageAspect;
    offsetY = (containerH - renderedH) / 2;
  }

  // Relative coordinate within actual rendered image content
  const relativeX = Math.max(0, Math.min(renderedW, clickX - offsetX));
  const relativeY = Math.max(0, Math.min(renderedH, clickY - offsetY));

  const scaleX = originalWidth / renderedW;
  const scaleY = originalHeight / renderedH;

  const origX = Math.round(relativeX * scaleX);
  const origY = Math.round(relativeY * scaleY);

  return {
    x: Math.max(0, Math.min(originalWidth, origX)),
    y: Math.max(0, Math.min(originalHeight, origY)),
  };
}

/**
 * Calculate Euclidean pixel distance between two 2D points
 */
export function calculatePixelDistance(p1: Point2D, p2: Point2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.round(Math.sqrt(dx * dx + dy * dy) * 100) / 100;
}

/**
 * Calculate polygon area using Shoelace formula (Surveyor's formula)
 */
export function calculatePolygonArea(points: Point2D[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2.0;
}

/**
 * Calculate perimeter of a polyline or closed polygon in pixels
 */
export function calculatePolylinePerimeter(points: Point2D[], isClosed: boolean = false): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += calculatePixelDistance(points[i], points[i + 1]);
  }
  if (isClosed && points.length >= 3) {
    total += calculatePixelDistance(points[points.length - 1], points[0]);
  }
  return Math.round(total * 100) / 100;
}

/**
 * Calculate Centroid of a polygon
 */
export function calculatePolygonCentroid(points: Point2D[]): Point2D {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length < 3) {
    let sumX = 0;
    let sumY = 0;
    for (const p of points) {
      sumX += p.x;
      sumY += p.y;
    }
    return { x: Math.round(sumX / points.length), y: Math.round(sumY / points.length) };
  }

  let signedArea = 0;
  let cx = 0;
  let cy = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const factor = points[i].x * points[j].y - points[j].x * points[i].y;
    signedArea += factor;
    cx += (points[i].x + points[j].x) * factor;
    cy += (points[i].y + points[j].y) * factor;
  }

  signedArea *= 0.5;
  if (Math.abs(signedArea) < 0.0001) {
    let sumX = 0;
    let sumY = 0;
    for (const p of points) {
      sumX += p.x;
      sumY += p.y;
    }
    return { x: Math.round(sumX / n), y: Math.round(sumY / n) };
  }

  cx = cx / (6 * signedArea);
  cy = cy / (6 * signedArea);

  return {
    x: Math.round(cx),
    y: Math.round(cy),
  };
}

/**
 * Calculate Bounding Box of a set of points
 */
export function calculateBoundingBox(
  points: Point2D[],
  metersPerPixel: number | null
): { minX: number; minY: number; maxX: number; maxY: number; widthMeters: number; heightMeters: number } | null {
  if (points.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const mPerPx = metersPerPixel || 0.005;
  const widthPx = maxX - minX;
  const heightPx = maxY - minY;

  return {
    minX,
    minY,
    maxX,
    maxY,
    widthMeters: Math.round(widthPx * mPerPx * 100) / 100,
    heightMeters: Math.round(heightPx * mPerPx * 100) / 100,
  };
}

/**
 * Sample depth at a specific normalized or original coordinate
 */
export function sampleDepthAtCoordinate(
  p: Point2D,
  depthData: DepthMapData | null,
  originalWidth: number,
  originalHeight: number
): number {
  if (!depthData || originalWidth <= 0 || originalHeight <= 0) return 0.5;
  const { width: dW, height: dH, depthMatrix } = depthData;
  const normX = Math.max(0, Math.min(1, p.x / originalWidth));
  const normY = Math.max(0, Math.min(1, p.y / originalHeight));

  const dX = Math.min(dW - 1, Math.floor(normX * dW));
  const dY = Math.min(dH - 1, Math.floor(normY * dH));
  const idx = dY * dW + dX;
  return depthMatrix[idx] ?? 0.5;
}

/**
 * Detailed Bending / Curvature Analysis across polyline points
 */
export function calculateBendingAnalysis(
  points: Point2D[],
  metersPerPixel: number,
  depthData: DepthMapData | null = null,
  originalWidth: number = 800,
  originalHeight: number = 600
) {
  if (points.length < 2) {
    return {
      totalPixelLength: 0,
      totalMeterLength: 0,
      chordPixelDistance: 0,
      chordMeterDistance: 0,
      maxDeflectionPixels: 0,
      maxDeflectionMeters: 0,
      bendingRatio: 1.0,
      totalAngleDeg: 0,
      segments: [],
      true3DLengthMeters: 0,
    };
  }

  const pStart = points[0];
  const pEnd = points[points.length - 1];

  // 1. Cumulative Path Segments & Angles
  let totalPixelLength = 0;
  const segments: Array<{
    p1: Point2D;
    p2: Point2D;
    pixelDistance: number;
    meterDistance: number;
    angleDeg: number;
  }> = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const distPx = calculatePixelDistance(p1, p2);
    const distM = Math.round(distPx * metersPerPixel * 100) / 100;
    totalPixelLength += distPx;

    // Angle of segment relative to previous segment
    let angleDeg = 0;
    if (i > 0) {
      const p0 = points[i - 1];
      const v1x = p1.x - p0.x;
      const v1y = p1.y - p0.y;
      const v2x = p2.x - p1.x;
      const v2y = p2.y - p1.y;
      const dot = v1x * v2x + v1y * v2y;
      const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
      const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);
      if (mag1 > 0 && mag2 > 0) {
        const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
        angleDeg = Math.round((Math.acos(cosAngle) * 180) / Math.PI * 10) / 10;
      }
    }

    segments.push({
      p1,
      p2,
      pixelDistance: distPx,
      meterDistance: distM,
      angleDeg,
    });
  }

  // Total cumulative turning angle
  const totalAngleDeg = segments.reduce((sum, s) => sum + s.angleDeg, 0);

  // 2. Chord distance (straight line between start and end)
  const chordPixelDistance = calculatePixelDistance(pStart, pEnd);
  const chordMeterDistance = Math.round(chordPixelDistance * metersPerPixel * 100) / 100;

  // 3. Max Sagitta / Deflection (perpendicular distance from chord line)
  let maxDeflectionPixels = 0;
  if (chordPixelDistance > 0.001) {
    const dx = pEnd.x - pStart.x;
    const dy = pEnd.y - pStart.y;
    const len = Math.sqrt(dx * dx + dy * dy);

    for (let i = 1; i < points.length - 1; i++) {
      const p = points[i];
      // Distance from point to line: |(dy)x - (dx)y + pEnd.x * pStart.y - pEnd.y * pStart.x| / len
      const dist = Math.abs(dy * p.x - dx * p.y + pEnd.x * pStart.y - pEnd.y * pStart.x) / len;
      if (dist > maxDeflectionPixels) {
        maxDeflectionPixels = dist;
      }
    }
  }

  const maxDeflectionMeters = Math.round(maxDeflectionPixels * metersPerPixel * 1000) / 1000;
  const totalMeterLength = Math.round(totalPixelLength * metersPerPixel * 100) / 100;
  const bendingRatio =
    chordMeterDistance > 0 ? Math.round((totalMeterLength / chordMeterDistance) * 100) / 100 : 1.0;

  // 4. Compute 3D True Path Length using Depth Map if available
  let true3DLengthMeters = totalMeterLength;
  if (depthData && depthData.depthMatrix) {
    let sum3DDist = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const z1 = sampleDepthAtCoordinate(p1, depthData, originalWidth, originalHeight) * 5.0; // scale factor
      const z2 = sampleDepthAtCoordinate(p2, depthData, originalWidth, originalHeight) * 5.0;
      const dxM = (p2.x - p1.x) * metersPerPixel;
      const dyM = (p2.y - p1.y) * metersPerPixel;
      const dzM = z2 - z1;
      sum3DDist += Math.sqrt(dxM * dxM + dyM * dyM + dzM * dzM);
    }
    true3DLengthMeters = Math.round(sum3DDist * 100) / 100;
  }

  return {
    totalPixelLength: Math.round(totalPixelLength * 10) / 10,
    totalMeterLength,
    chordPixelDistance: Math.round(chordPixelDistance * 10) / 10,
    chordMeterDistance,
    maxDeflectionPixels: Math.round(maxDeflectionPixels * 10) / 10,
    maxDeflectionMeters,
    bendingRatio,
    totalAngleDeg: Math.round(totalAngleDeg * 10) / 10,
    segments,
    true3DLengthMeters,
  };
}

/**
 * Generate smooth SVG path string from control points using Cardinal/Catmull-Rom Spline
 */
export function getSmoothSplinePath(
  points: Point2D[],
  origW: number,
  origH: number,
  isClosed: boolean = false
): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const px = (points[0].x / origW) * 100;
    const py = (points[0].y / origH) * 100;
    return `M ${px} ${py}`;
  }
  if (points.length === 2) {
    const p0x = (points[0].x / origW) * 100;
    const p0y = (points[0].y / origH) * 100;
    const p1x = (points[1].x / origW) * 100;
    const p1y = (points[1].y / origH) * 100;
    return `M ${p0x} ${p0y} L ${p1x} ${p1y}`;
  }

  // Convert points to percentage coordinates
  const pts = points.map((p) => ({
    x: (p.x / origW) * 100,
    y: (p.y / origH) * 100,
  }));

  let path = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;

  if (isClosed) {
    // Closed polygon path
    for (let i = 1; i < pts.length; i++) {
      path += ` L ${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)}`;
    }
    path += ' Z';
    return path;
  }

  // Catmull-Rom to Cubic Bézier for open bending paths
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = i > 0 ? pts[i - 1] : pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = i < pts.length - 2 ? pts[i + 2] : p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;

    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  return path;
}

/**
 * Sample average depth and depth variance inside an irregular polygon
 */
export function sampleDepthInsidePolygon(
  points: Point2D[],
  depthData: DepthMapData | null,
  originalWidth: number,
  originalHeight: number
): { avgDepth: number; depthVariance: number } {
  if (!depthData || points.length < 3) {
    return { avgDepth: 0.5, depthVariance: 0 };
  }

  const { width: dW, height: dH, depthMatrix } = depthData;

  // Convert points to depth map coordinate space
  const poly = points.map((p) => ({
    x: (p.x / originalWidth) * dW,
    y: (p.y / originalHeight) * dH,
  }));

  // Bounding box in depth map space
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of poly) {
    if (p.x < minX) minX = Math.floor(p.x);
    if (p.x > maxX) maxX = Math.ceil(p.x);
    if (p.y < minY) minY = Math.floor(p.y);
    if (p.y > maxY) maxY = Math.ceil(p.y);
  }

  minX = Math.max(0, minX);
  minY = Math.max(0, minY);
  maxX = Math.min(dW - 1, maxX);
  maxY = Math.min(dH - 1, maxY);

  // Point in polygon test
  function pointInPolygon(px: number, py: number): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;
      const intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  const samples: number[] = [];
  const step = Math.max(1, Math.floor(Math.sqrt((maxX - minX) * (maxY - minY) / 500)));

  for (let y = minY; y <= maxY; y += step) {
    for (let x = minX; x <= maxX; x += step) {
      if (pointInPolygon(x, y)) {
        const idx = y * dW + x;
        samples.push(depthMatrix[idx]);
      }
    }
  }

  if (samples.length === 0) return { avgDepth: 0.5, depthVariance: 0 };

  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  const variance = samples.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / samples.length;

  return {
    avgDepth: Math.round(avg * 1000) / 1000,
    depthVariance: Math.round(Math.sqrt(variance) * 1000) / 1000,
  };
}
