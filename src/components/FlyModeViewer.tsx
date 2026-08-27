import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { DepthMapData, FlyModeControls } from '../types';
import {
  Compass,
  Play,
  Pause,
  RotateCcw,
  X,
  Sliders,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowUpCircle,
  ArrowDownCircle,
  Sparkles,
} from 'lucide-react';

interface FlyModeViewerProps {
  originalImageSrc: string;
  depthData: DepthMapData;
  depthStrength?: number;
  onExit: () => void;
}

export const FlyModeViewer: React.FC<FlyModeViewerProps> = ({
  originalImageSrc,
  depthData,
  depthStrength = 1.4,
  onExit,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // States
  const [isAutoFlyover, setIsAutoFlyover] = useState<boolean>(false);
  const [isFlyoverPaused, setIsFlyoverPaused] = useState<boolean>(false);
  const [flySpeed, setFlySpeed] = useState<number>(1.0); // 0.5 to 2.5
  const [currentAltitude, setCurrentAltitude] = useState<number>(0.0);

  // Three.js instances
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Fly controls state
  const keysPressedRef = useRef<FlyModeControls>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
  });

  const mouseLookRef = useRef<{ yaw: number; pitch: number; isDragging: boolean; lastX: number; lastY: number }>({
    yaw: 0,
    pitch: 0,
    isDragging: false,
    lastX: 0,
    lastY: 0,
  });

  const autoFlyoverProgressRef = useRef<number>(0);

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060913); // Atmospheric deep space/sky
    scene.fog = new THREE.FogExp2(0x060913, 0.15);
    sceneRef.current = scene;

    // Camera (Fly camera starts near the front perspective center)
    const camera = new THREE.PerspectiveCamera(65, width / height, 0.05, 500);
    camera.position.set(0, 0, 1.8);
    camera.rotation.order = 'YXZ';
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.3);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x93c5fd, 0.9);
    dirLight.position.set(1, 3, 2);
    scene.add(dirLight);

    // Create 3D Mesh for Fly navigation
    const { width: dW, height: dH, depthMatrix } = depthData;
    const aspect = dW / dH;
    const planeW = 3.2 * (aspect >= 1 ? 1 : aspect);
    const planeH = 3.2 / (aspect >= 1 ? aspect : 1);
    const segX = 200;
    const segY = Math.round(200 / aspect);

    const geometry = new THREE.PlaneGeometry(planeW, planeH, segX, segY);
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) / planeW + 0.5;
      const v = 0.5 - pos.getY(i) / planeH;
      const sX = Math.max(0, Math.min(dW - 1, Math.floor(u * dW)));
      const sY = Math.max(0, Math.min(dH - 1, Math.floor(v * dH)));
      const d = depthMatrix[sY * dW + sX] || 0.5;
      pos.setZ(i, (0.5 - d) * depthStrength * 1.2);
    }
    pos.needsUpdate = true;
    geometry.computeVertexNormals();

    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(originalImageSrc, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      const material = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.5,
        metalness: 0.05,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
    });

    // Key handlers
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onExit();
        return;
      }
      const k = e.key.toLowerCase();
      if (k === 'w' || e.key === 'ArrowUp') keysPressedRef.current.forward = true;
      if (k === 's' || e.key === 'ArrowDown') keysPressedRef.current.backward = true;
      if (k === 'a' || e.key === 'ArrowLeft') keysPressedRef.current.left = true;
      if (k === 'd' || e.key === 'ArrowRight') keysPressedRef.current.right = true;
      if (k === 'e') keysPressedRef.current.up = true;
      if (k === 'q') keysPressedRef.current.down = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || e.key === 'ArrowUp') keysPressedRef.current.forward = false;
      if (k === 's' || e.key === 'ArrowDown') keysPressedRef.current.backward = false;
      if (k === 'a' || e.key === 'ArrowLeft') keysPressedRef.current.left = false;
      if (k === 'd' || e.key === 'ArrowRight') keysPressedRef.current.right = false;
      if (k === 'e') keysPressedRef.current.up = false;
      if (k === 'q') keysPressedRef.current.down = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Animation & Flight Update Loop
    let lastTime = performance.now();

    const renderLoop = (time: number) => {
      animFrameRef.current = requestAnimationFrame(renderLoop);
      const delta = (time - lastTime) / 1000;
      lastTime = time;

      if (!cameraRef.current || !rendererRef.current || !sceneRef.current) return;
      const cam = cameraRef.current;

      if (isAutoFlyover && !isFlyoverPaused) {
        // Automatic cinematic flight trajectory
        autoFlyoverProgressRef.current += delta * 0.18 * flySpeed;
        const p = autoFlyoverProgressRef.current;

        // Parametric flight path: sweeping figure-8 and depth swoop
        const camX = Math.sin(p) * 0.8;
        const camY = Math.sin(p * 2) * 0.25 + 0.1;
        const camZ = 1.4 + Math.cos(p * 1.5) * 0.7;

        cam.position.set(camX, camY, camZ);
        cam.lookAt(Math.sin(p * 1.2) * 0.2, 0, (0.5 - 0.5) * depthStrength);
        setCurrentAltitude(Math.round(camY * 100) / 100);
      } else {
        // Manual Flight Physics
        const moveSpeed = 1.4 * flySpeed * delta;
        const keys = keysPressedRef.current;

        // Movement directions relative to camera look
        const forwardDir = new THREE.Vector3();
        cam.getWorldDirection(forwardDir);
        forwardDir.normalize();

        const rightDir = new THREE.Vector3();
        rightDir.crossVectors(forwardDir, new THREE.Vector3(0, 1, 0)).normalize();

        if (keys.forward) cam.position.addScaledVector(forwardDir, moveSpeed);
        if (keys.backward) cam.position.addScaledVector(forwardDir, -moveSpeed);
        if (keys.left) cam.position.addScaledVector(rightDir, -moveSpeed);
        if (keys.right) cam.position.addScaledVector(rightDir, moveSpeed);
        if (keys.up) cam.position.y += moveSpeed * 0.8;
        if (keys.down) cam.position.y -= moveSpeed * 0.8;

        // Apply mouse pitch/yaw
        cam.rotation.x = mouseLookRef.current.pitch;
        cam.rotation.y = mouseLookRef.current.yaw;

        setCurrentAltitude(Math.round(cam.position.y * 100) / 100);
      }

      rendererRef.current.render(sceneRef.current, cam);
    };

    animFrameRef.current = requestAnimationFrame(renderLoop);

    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', handleResize);
      if (rendererRef.current) rendererRef.current.dispose();
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [originalImageSrc, depthData, depthStrength, isAutoFlyover, isFlyoverPaused, flySpeed, onExit]);

  // Mouse drag handlers for Look around
  const handleMouseDown = (e: React.MouseEvent) => {
    mouseLookRef.current.isDragging = true;
    mouseLookRef.current.lastX = e.clientX;
    mouseLookRef.current.lastY = e.clientY;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!mouseLookRef.current.isDragging || isAutoFlyover) return;
    const deltaX = e.clientX - mouseLookRef.current.lastX;
    const deltaY = e.clientY - mouseLookRef.current.lastY;

    mouseLookRef.current.yaw -= deltaX * 0.003;
    mouseLookRef.current.pitch -= deltaY * 0.003;
    // Clamp pitch
    mouseLookRef.current.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, mouseLookRef.current.pitch));

    mouseLookRef.current.lastX = e.clientX;
    mouseLookRef.current.lastY = e.clientY;
  };

  const handleMouseUp = () => {
    mouseLookRef.current.isDragging = false;
  };

  // Virtual Joystick button events for mobile
  const setKey = (key: keyof FlyModeControls, value: boolean) => {
    keysPressedRef.current[key] = value;
  };

  const handleResetFlight = () => {
    if (!cameraRef.current) return;
    cameraRef.current.position.set(0, 0, 1.8);
    mouseLookRef.current.yaw = 0;
    mouseLookRef.current.pitch = 0;
    cameraRef.current.rotation.set(0, 0, 0);
  };

  return (
    <div className="relative w-full h-[650px] sm:h-[750px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl select-none">
      {/* 3D WebGL Canvas */}
      <div
        ref={mountRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="w-full h-full cursor-crosshair"
      />

      {/* Top Header HUD Bar */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto bg-slate-900/85 backdrop-blur border border-slate-700 p-2 sm:px-4 sm:py-2.5 rounded-2xl text-white shadow-lg">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-xs">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <span className="text-sm font-black tracking-tight block">✈️ Fly Mode</span>
            <span className="text-[11px] text-slate-400">
              {isAutoFlyover ? 'Cinematic Auto Flight Active' : 'Manual 6-DOF Flight'}
            </span>
          </div>
        </div>

        {/* Exit Button */}
        <button
          id="btn-exit-fly-mode"
          onClick={onExit}
          className="pointer-events-auto flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-lg transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
          <span>Exit Fly Mode (ESC)</span>
        </button>
      </div>

      {/* Control Guide Card Overlay */}
      <div className="absolute top-20 left-4 bg-slate-900/80 backdrop-blur border border-slate-700/70 p-3.5 rounded-2xl text-white text-xs space-y-2 pointer-events-none max-w-xs shadow-xl hidden sm:block">
        <span className="font-bold text-blue-400 block uppercase tracking-wider text-[10px]">
          Flight Controls
        </span>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-300">
          <div><span className="font-mono bg-white/10 px-1 rounded text-white font-bold">W</span> Forward</div>
          <div><span className="font-mono bg-white/10 px-1 rounded text-white font-bold">S</span> Backward</div>
          <div><span className="font-mono bg-white/10 px-1 rounded text-white font-bold">A</span> Strafe Left</div>
          <div><span className="font-mono bg-white/10 px-1 rounded text-white font-bold">D</span> Strafe Right</div>
          <div><span className="font-mono bg-white/10 px-1 rounded text-white font-bold">E</span> Fly Up</div>
          <div><span className="font-mono bg-white/10 px-1 rounded text-white font-bold">Q</span> Fly Down</div>
        </div>
        <div className="text-[10px] text-slate-400 border-t border-slate-800 pt-1.5 flex items-center gap-2">
          <span>Mouse Drag = Look</span>
          <span>•</span>
          <span>ESC = Exit</span>
        </div>
      </div>

      {/* FEATURE 12 — AUTOMATIC FLYOVER DOCK */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur border border-slate-700 p-3 sm:px-5 sm:py-3 rounded-2xl shadow-2xl flex flex-wrap items-center gap-3 sm:gap-4 text-white z-20">
        {!isAutoFlyover ? (
          <button
            id="btn-start-flyover"
            onClick={() => {
              setIsAutoFlyover(true);
              setIsFlyoverPaused(false);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all hover:scale-105 active:scale-100 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>▶ Start Flyover</span>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFlyoverPaused(!isFlyoverPaused)}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              {isFlyoverPaused ? (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Resume</span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Pause</span>
                </>
              )}
            </button>

            <button
              onClick={() => {
                setIsAutoFlyover(false);
                setIsFlyoverPaused(false);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer"
            >
              <span>Stop Auto</span>
            </button>
          </div>
        )}

        {/* Speed Slider */}
        <div className="flex items-center gap-2 border-l border-slate-700 pl-3 sm:pl-4">
          <Sliders className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="text-[11px] text-slate-300 whitespace-nowrap">Speed:</span>
          <input
            type="range"
            min="0.5"
            max="2.5"
            step="0.1"
            value={flySpeed}
            onChange={(e) => setFlySpeed(parseFloat(e.target.value))}
            className="w-20 sm:w-28 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <span className="text-[11px] font-mono font-bold text-blue-400">{flySpeed.toFixed(1)}x</span>
        </div>

        <button
          onClick={handleResetFlight}
          className="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white cursor-pointer"
          title="Reset Position"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Mobile Virtual D-Pad & Altitude Controls (Visible on smaller screens) */}
      <div className="sm:hidden absolute bottom-24 left-4 flex flex-col items-center gap-1 bg-slate-900/80 p-2 rounded-2xl border border-slate-700 z-10">
        <button
          onMouseDown={() => setKey('forward', true)}
          onMouseUp={() => setKey('forward', false)}
          onTouchStart={() => setKey('forward', true)}
          onTouchEnd={() => setKey('forward', false)}
          className="w-9 h-9 bg-slate-800 active:bg-blue-600 rounded-lg text-white flex items-center justify-center"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
        <div className="flex gap-1">
          <button
            onMouseDown={() => setKey('left', true)}
            onMouseUp={() => setKey('left', false)}
            onTouchStart={() => setKey('left', true)}
            onTouchEnd={() => setKey('left', false)}
            className="w-9 h-9 bg-slate-800 active:bg-blue-600 rounded-lg text-white flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onMouseDown={() => setKey('backward', true)}
            onMouseUp={() => setKey('backward', false)}
            onTouchStart={() => setKey('backward', true)}
            onTouchEnd={() => setKey('backward', false)}
            className="w-9 h-9 bg-slate-800 active:bg-blue-600 rounded-lg text-white flex items-center justify-center"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
          <button
            onMouseDown={() => setKey('right', true)}
            onMouseUp={() => setKey('right', false)}
            onTouchStart={() => setKey('right', true)}
            onTouchEnd={() => setKey('right', false)}
            className="w-9 h-9 bg-slate-800 active:bg-blue-600 rounded-lg text-white flex items-center justify-center"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Altitude Up/Down Mobile buttons */}
      <div className="sm:hidden absolute bottom-24 right-4 flex flex-col gap-2 bg-slate-900/80 p-2 rounded-2xl border border-slate-700 z-10">
        <button
          onMouseDown={() => setKey('up', true)}
          onMouseUp={() => setKey('up', false)}
          onTouchStart={() => setKey('up', true)}
          onTouchEnd={() => setKey('up', false)}
          className="w-10 h-10 bg-slate-800 active:bg-blue-600 rounded-xl text-white flex items-center justify-center"
        >
          <ArrowUpCircle className="w-6 h-6" />
        </button>
        <button
          onMouseDown={() => setKey('down', true)}
          onMouseUp={() => setKey('down', false)}
          onTouchStart={() => setKey('down', true)}
          onTouchEnd={() => setKey('down', false)}
          className="w-10 h-10 bg-slate-800 active:bg-blue-600 rounded-xl text-white flex items-center justify-center"
        >
          <ArrowDownCircle className="w-6 h-6" />
        </button>
      </div>

      {/* Crosshair Center Reticle */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
        <div className="w-3 h-3 border border-white/40 rounded-full flex items-center justify-center">
          <div className="w-0.5 h-0.5 bg-blue-400 rounded-full" />
        </div>
      </div>
    </div>
  );
};
