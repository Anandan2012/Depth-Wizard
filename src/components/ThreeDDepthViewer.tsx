import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { DepthMapData, MeshRenderMode } from '../types';
import {
  RotateCcw,
  Maximize2,
  Sliders,
  Sparkles,
  Camera,
  Layers,
  ZoomIn,
  ZoomOut,
  Eye,
} from 'lucide-react';

interface ThreeDDepthViewerProps {
  originalImageSrc: string;
  depthData: DepthMapData;
  onEnterFlyMode: () => void;
}

export const ThreeDDepthViewer: React.FC<ThreeDDepthViewerProps> = ({
  originalImageSrc,
  depthData,
  onEnterFlyMode,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [viewDimension, setViewDimension] = useState<'2D' | '3D'>('3D');
  const [depthStrength, setDepthStrength] = useState<number>(1.2); // 0.0 to 3.0
  const [renderMode, setRenderMode] = useState<MeshRenderMode>('mesh');
  const [pointDensity, setPointDensity] = useState<'normal' | 'high' | 'ultra'>('high');

  // Internal Three.js references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshRef = useRef<THREE.Mesh | THREE.Points | null>(null);
  const geometryRef = useRef<THREE.PlaneGeometry | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const previousMousePositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const cameraTargetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));

  // Initialize Three.js Scene
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d); // deep dark blue slate backdrop for vibrant 3D contrast
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 0, 3.2);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;

    // Empty previous canvas
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    // Ambient & Directional Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(2, 4, 3);
    scene.add(dirLight);

    // Build the 3D Displaced Mesh / Points
    buildSceneMesh();

    // Render loop
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    // Resize observer
    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      resizeObserver.disconnect();
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Function to build/rebuild 3D Mesh when density, image, or depth map updates
  const buildSceneMesh = () => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    // Remove old mesh
    if (meshRef.current) {
      scene.remove(meshRef.current);
      if (meshRef.current.geometry) meshRef.current.geometry.dispose();
      meshRef.current = null;
    }

    const { width: dW, height: dH, depthMatrix } = depthData;
    const aspect = dW / dH;

    // Subdivisions for mesh grid
    const segs = pointDensity === 'ultra' ? 256 : pointDensity === 'high' ? 180 : 120;
    const segX = Math.round(segs * (aspect >= 1 ? 1 : aspect));
    const segY = Math.round(segs / (aspect >= 1 ? aspect : 1));

    const planeW = 2.4 * (aspect >= 1 ? 1 : aspect);
    const planeH = 2.4 / (aspect >= 1 ? aspect : 1);

    const geometry = new THREE.PlaneGeometry(planeW, planeH, segX, segY);
    geometryRef.current = geometry;

    // Displace vertices along Z using depth matrix
    const pos = geometry.attributes.position;
    const count = pos.count;
    const currentStrength = viewDimension === '2D' ? 0.0 : depthStrength;

    for (let i = 0; i < count; i++) {
      const u = (pos.getX(i) / planeW) + 0.5; // 0 to 1
      const v = 0.5 - (pos.getY(i) / planeH); // 0 to 1

      const sampleX = Math.max(0, Math.min(dW - 1, Math.floor(u * dW)));
      const sampleY = Math.max(0, Math.min(dH - 1, Math.floor(v * dH)));
      const depthVal = depthMatrix[sampleY * dW + sampleX] || 0.5; // 0.0 (near) to 1.0 (far)

      // Z displacement: near objects push forward (positive Z)
      const zOffset = (0.5 - depthVal) * currentStrength * 0.8;
      pos.setZ(i, zOffset);
    }
    pos.needsUpdate = true;
    geometry.computeVertexNormals();

    // Texture from original image
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(originalImageSrc, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;

      let newMesh: THREE.Mesh | THREE.Points;

      if (renderMode === 'points') {
        const pointsMat = new THREE.PointsMaterial({
          size: pointDensity === 'ultra' ? 0.015 : 0.025,
          map: texture,
          transparent: true,
          sizeAttenuation: true,
        });
        newMesh = new THREE.Points(geometry, pointsMat);
      } else {
        const meshMat = new THREE.MeshStandardMaterial({
          map: texture,
          wireframe: renderMode === 'wireframe',
          roughness: 0.4,
          metalness: 0.1,
          side: THREE.DoubleSide,
        });
        newMesh = new THREE.Mesh(geometry, meshMat);
      }

      scene.add(newMesh);
      meshRef.current = newMesh;
    });
  };

  // Re-apply depth displacement when strength or 2D/3D toggle changes
  useEffect(() => {
    if (!geometryRef.current) return;
    const geometry = geometryRef.current;
    const pos = geometry.attributes.position;
    const count = pos.count;
    const { width: dW, height: dH, depthMatrix } = depthData;
    const aspect = dW / dH;
    const planeW = 2.4 * (aspect >= 1 ? 1 : aspect);
    const planeH = 2.4 / (aspect >= 1 ? aspect : 1);

    const currentStrength = viewDimension === '2D' ? 0.0 : depthStrength;

    for (let i = 0; i < count; i++) {
      const u = (pos.getX(i) / planeW) + 0.5;
      const v = 0.5 - (pos.getY(i) / planeH);

      const sampleX = Math.max(0, Math.min(dW - 1, Math.floor(u * dW)));
      const sampleY = Math.max(0, Math.min(dH - 1, Math.floor(v * dH)));
      const depthVal = depthMatrix[sampleY * dW + sampleX] || 0.5;

      const zOffset = (0.5 - depthVal) * currentStrength * 0.8;
      pos.setZ(i, zOffset);
    }
    pos.needsUpdate = true;
    geometry.computeVertexNormals();
  }, [depthStrength, viewDimension, depthData]);

  // Rebuild mesh when render mode or point density changes
  useEffect(() => {
    buildSceneMesh();
  }, [renderMode, pointDensity]);

  // Mouse Orbit / Pan / Rotate Controls
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !meshRef.current || !cameraRef.current) return;
    const deltaX = e.clientX - previousMousePositionRef.current.x;
    const deltaY = e.clientY - previousMousePositionRef.current.y;

    if (e.buttons === 1) {
      // Left Click: Rotate Mesh
      meshRef.current.rotation.y += deltaX * 0.008;
      meshRef.current.rotation.x += deltaY * 0.008;
      // Clamp X rotation to avoid flipping upside down
      meshRef.current.rotation.x = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, meshRef.current.rotation.x));
    } else if (e.buttons === 2 || e.shiftKey) {
      // Right Click or Shift+Click: Pan Camera
      cameraRef.current.position.x -= deltaX * 0.005;
      cameraRef.current.position.y += deltaY * 0.005;
    }

    previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!cameraRef.current) return;
    const zoomFactor = e.deltaY * 0.002;
    cameraRef.current.position.z = Math.max(0.8, Math.min(8.0, cameraRef.current.position.z + zoomFactor));
  };

  const handleResetCamera = () => {
    if (cameraRef.current && meshRef.current) {
      cameraRef.current.position.set(0, 0, 3.2);
      meshRef.current.rotation.set(0, 0, 0);
      meshRef.current.position.set(0, 0, 0);
    }
  };

  const handleZoom = (direction: 'in' | 'out') => {
    if (!cameraRef.current) return;
    const delta = direction === 'in' ? -0.4 : 0.4;
    cameraRef.current.position.z = Math.max(0.8, Math.min(8.0, cameraRef.current.position.z + delta));
  };

  const handleCaptureScreenshot = () => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
    rendererRef.current.render(sceneRef.current, cameraRef.current);
    const dataUrl = rendererRef.current.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'depth-wizard-3d-scene.png';
    link.href = dataUrl;
    link.click();
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* 3D Controls Bar */}
      <div className="bg-white rounded-2xl border border-blue-100 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Left: 2D/3D Mode & Mesh Style */}
        <div className="flex flex-wrap items-center gap-3">
          {/* 2D / 3D View Switch */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs">
            <button
              id="btn-view-2d"
              onClick={() => setViewDimension('2D')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                viewDimension === '2D' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
              }`}
            >
              2D Flat
            </button>
            <button
              id="btn-view-3d"
              onClick={() => setViewDimension('3D')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                viewDimension === '3D' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
              }`}
            >
              3D Depth
            </button>
          </div>

          {/* Render Mode */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setRenderMode('mesh')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                renderMode === 'mesh' ? 'bg-white text-blue-600 shadow-xs font-bold' : 'text-slate-600'
              }`}
            >
              Mesh
            </button>
            <button
              onClick={() => setRenderMode('points')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                renderMode === 'points' ? 'bg-white text-blue-600 shadow-xs font-bold' : 'text-slate-600'
              }`}
            >
              Point Cloud
            </button>
            <button
              onClick={() => setRenderMode('wireframe')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                renderMode === 'wireframe' ? 'bg-white text-blue-600 shadow-xs font-bold' : 'text-slate-600'
              }`}
            >
              Wireframe
            </button>
          </div>

          {/* Point Density selector */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-semibold hidden sm:inline">Density:</span>
            <select
              value={pointDensity}
              onChange={(e) => setPointDensity(e.target.value as any)}
              className="bg-slate-100 border border-slate-200 text-slate-800 text-xs rounded-lg px-2 py-1.5 font-medium focus:ring-2 focus:ring-blue-500"
            >
              <option value="normal">Normal (120k)</option>
              <option value="high">High (180k)</option>
              <option value="ultra">Ultra (256k)</option>
            </select>
          </div>
        </div>

        {/* Right: Fly Mode Trigger & Screenshot */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCaptureScreenshot}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            title="Snapshot 3D rendering"
          >
            <Camera className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Screenshot</span>
          </button>

          <button
            id="btn-launch-fly-mode"
            onClick={onEnterFlyMode}
            className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-md shadow-blue-500/20 transition-all hover:scale-105 active:scale-100 cursor-pointer"
          >
            <span>✈️ Enter Fly Mode</span>
          </button>
        </div>
      </div>

      {/* FEATURE 10 — Depth Strength Slider (0x to 3x) */}
      <div className="bg-white rounded-2xl border border-blue-100 p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <Sliders className="w-4 h-4 text-blue-600" />
            <span>Depth Strength: <span className="text-blue-600 font-mono text-sm">{depthStrength.toFixed(1)}x</span></span>
          </div>
          <div className="flex items-center gap-2 text-slate-500 font-medium">
            <span className={depthStrength === 0 ? 'text-blue-600 font-bold' : ''}>0x (Flat)</span>
            <span>•</span>
            <span className={depthStrength >= 0.9 && depthStrength <= 1.1 ? 'text-blue-600 font-bold' : ''}>1x (Normal)</span>
            <span>•</span>
            <span className={depthStrength >= 1.9 && depthStrength <= 2.1 ? 'text-blue-600 font-bold' : ''}>2x (Exaggerated)</span>
            <span>•</span>
            <span className={depthStrength >= 2.9 ? 'text-blue-600 font-bold' : ''}>3x (Highly Exaggerated)</span>
          </div>
        </div>

        <input
          id="slider-depth-strength"
          type="range"
          min="0"
          max="3"
          step="0.1"
          value={depthStrength}
          onChange={(e) => setDepthStrength(parseFloat(e.target.value))}
          className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
      </div>

      {/* 3D WebGL Canvas Viewport */}
      <div className="bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-xl relative aspect-16/10 sm:aspect-16/9 flex items-center justify-center">
        <div
          ref={mountRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onContextMenu={(e) => e.preventDefault()}
          className="w-full h-full cursor-grab active:cursor-grabbing"
        />

        {/* HUD Quick Tools Overlay */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 bg-slate-900/80 backdrop-blur border border-slate-700/60 p-1.5 rounded-xl text-white">
          <button
            onClick={() => handleZoom('in')}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleZoom('out')}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetCamera}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            title="Reset Camera Orientation"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Viewport helper info */}
        <div className="absolute bottom-4 left-4 bg-slate-900/80 backdrop-blur border border-slate-700/60 text-slate-300 text-[11px] px-3 py-1.5 rounded-xl pointer-events-none flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span>Left Click + Drag: Rotate</span>
          <span>•</span>
          <span>Right Click / Shift: Pan</span>
          <span>•</span>
          <span>Scroll: Zoom</span>
        </div>
      </div>
    </div>
  );
};
