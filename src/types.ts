export type DepthColorMap = 'grayscale' | 'turbo' | 'inferno' | 'viridis' | 'spectral' | 'inverted';

export interface Point2D {
  x: number; // in original image coordinates
  y: number; // in original image coordinates
}

export interface CalibrationData {
  pointA: Point2D | null;
  pointB: Point2D | null;
  referencePixelDistance: number | null;
  knownDistanceMeters: number | null;
  metersPerPixel: number | null;
  isCalibrated: boolean;
}

export type MeasurementType = 'straight' | 'bending' | 'irregular_area';

export interface MeasurementData {
  pointC: Point2D | null;
  pointD: Point2D | null;
  measuredPixelDistance: number | null;
  estimatedDistanceMeters: number | null;
  isComplete: boolean;
}

export interface BendingSegment {
  p1: Point2D;
  p2: Point2D;
  pixelDistance: number;
  meterDistance: number;
  angleDeg: number;
}

export interface BendMeasurementData {
  points: Point2D[];
  totalPixelLength: number | null;
  totalMeterLength: number | null;
  chordPixelDistance: number | null;
  chordMeterDistance: number | null;
  maxDeflectionPixels: number | null;
  maxDeflectionMeters: number | null; // maximum perpendicular sagitta from chord
  bendingRatio: number | null; // total length / chord length
  totalAngleDeg: number | null; // cumulative angular bend
  segments: BendingSegment[];
  true3DLengthMeters: number | null; // 3D path length considering depth variation
  isComplete: boolean;
}

export interface AreaMeasurementData {
  points: Point2D[];
  drawMethod: 'polygon' | 'freehand';
  pixelArea: number | null;
  meterArea: number | null; // square meters (m²)
  sqFeetArea: number | null; // square feet (ft²)
  sqCmArea: number | null; // square centimeters (cm²)
  pixelPerimeter: number | null;
  meterPerimeter: number | null;
  boundingRect: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    widthMeters: number;
    heightMeters: number;
  } | null;
  centroid: Point2D | null;
  avgDepth: number | null; // 0.0 to 1.0
  depthVariance: number | null;
  isClosed: boolean;
  isComplete: boolean;
}

export interface DepthAnalysisResult {
  confidenceScore: number;
  confidenceRationale: string;
  sceneType: string;
  planesDetected: Array<{
    name: string;
    relativeDepth: string;
    confidence: number;
  }>;
  focalCues: {
    hasHorizon: boolean;
    surfaceClarity: string;
    distortionRisk: string;
  };
}

export interface DepthMapData {
  width: number;
  height: number;
  depthMatrix: Float32Array; // values between 0.0 (near) and 1.0 (far)
  canvas: HTMLCanvasElement;
  dataUrl: string; // grayscale default
}

export type ViewMode = '2D' | '3D' | 'FLY';
export type ComparisonMode = 'side-by-side' | 'slider';
export type MeshRenderMode = 'mesh' | 'points' | 'wireframe';

export interface FlyModeControls {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}
