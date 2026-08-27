import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  CalibrationData,
  MeasurementData,
  BendMeasurementData,
  AreaMeasurementData,
  MeasurementType,
  Point2D,
  DepthMapData,
} from '../types';
import {
  calculatePixelDistance,
  getOriginalImageCoordinates,
  calculatePolygonArea,
  calculatePolylinePerimeter,
  calculatePolygonCentroid,
  calculateBoundingBox,
  calculateBendingAnalysis,
  getSmoothSplinePath,
  sampleDepthInsidePolygon,
} from '../utils/depthEngine';
import {
  Ruler,
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Undo2,
  Spline,
  Hexagon,
  Pencil,
  MousePointerClick,
  Maximize2,
  Compass,
  Layers,
  Check,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface MeasurementToolProps {
  imageSrc: string;
  originalWidth: number;
  originalHeight: number;
  depthData?: DepthMapData | null;
  calibration: CalibrationData;
  setCalibration: React.Dispatch<React.SetStateAction<CalibrationData>>;
  measurement: MeasurementData;
  setMeasurement: React.Dispatch<React.SetStateAction<MeasurementData>>;
  bendMeasurement?: BendMeasurementData;
  setBendMeasurement?: React.Dispatch<React.SetStateAction<BendMeasurementData>>;
  areaMeasurement?: AreaMeasurementData;
  setAreaMeasurement?: React.Dispatch<React.SetStateAction<AreaMeasurementData>>;
  activeMode?: MeasurementType;
  onChangeMode?: (mode: MeasurementType) => void;
}

export const MeasurementTool: React.FC<MeasurementToolProps> = ({
  imageSrc,
  originalWidth,
  originalHeight,
  depthData = null,
  calibration,
  setCalibration,
  measurement,
  setMeasurement,
  bendMeasurement: externalBend,
  setBendMeasurement: externalSetBend,
  areaMeasurement: externalArea,
  setAreaMeasurement: externalSetArea,
  activeMode: externalMode,
  onChangeMode: externalSetMode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [knownDistanceInput, setKnownDistanceInput] = useState<string>('1.00');
  const [activeStep, setActiveStep] = useState<'calibrate' | 'measure'>(
    calibration.isCalibrated ? 'measure' : 'calibrate'
  );

  // Internal measurement mode fallback if not provided externally
  const [internalMode, setInternalMode] = useState<MeasurementType>('straight');
  const currentMode = externalMode || internalMode;
  const setMode = (m: MeasurementType) => {
    if (externalSetMode) externalSetMode(m);
    else setInternalMode(m);
  };

  // Internal Bending State fallback
  const [internalBend, setInternalBend] = useState<BendMeasurementData>({
    points: [],
    totalPixelLength: null,
    totalMeterLength: null,
    chordPixelDistance: null,
    chordMeterDistance: null,
    maxDeflectionPixels: null,
    maxDeflectionMeters: null,
    bendingRatio: null,
    totalAngleDeg: null,
    segments: [],
    true3DLengthMeters: null,
    isComplete: false,
  });
  const bendData = externalBend || internalBend;
  const setBendData = externalSetBend || setInternalBend;

  // Internal Irregular Area State fallback
  const [internalArea, setInternalArea] = useState<AreaMeasurementData>({
    points: [],
    drawMethod: 'polygon',
    pixelArea: null,
    meterArea: null,
    sqFeetArea: null,
    sqCmArea: null,
    pixelPerimeter: null,
    meterPerimeter: null,
    boundingRect: null,
    centroid: null,
    avgDepth: null,
    depthVariance: null,
    isClosed: false,
    isComplete: false,
  });
  const areaData = externalArea || internalArea;
  const setAreaData = externalSetArea || setInternalArea;

  // Drawing state for freehand lasso
  const [isDrawingFreehand, setIsDrawingFreehand] = useState<boolean>(false);
  const [hoverCoord, setHoverCoord] = useState<Point2D | null>(null);

  // Sync activeStep if calibration changes externally
  useEffect(() => {
    if (calibration.isCalibrated && !measurement.isComplete && !bendData.isComplete && !areaData.isComplete) {
      setActiveStep('measure');
    }
  }, [calibration.isCalibrated, measurement.isComplete, bendData.isComplete, areaData.isComplete]);

  // Submit calibration distance in meters
  const handleConfirmCalibration = () => {
    const meters = parseFloat(knownDistanceInput);
    if (!meters || meters <= 0 || !calibration.referencePixelDistance) return;

    const metersPerPixel = meters / calibration.referencePixelDistance;
    setCalibration((prev) => ({
      ...prev,
      knownDistanceMeters: meters,
      metersPerPixel,
      isCalibrated: true,
    }));
    setActiveStep('measure');
  };

  const handleRecalibrate = () => {
    setCalibration({
      pointA: null,
      pointB: null,
      referencePixelDistance: null,
      knownDistanceMeters: null,
      metersPerPixel: null,
      isCalibrated: false,
    });
    handleResetAllMeasurements();
    setActiveStep('calibrate');
  };

  const fireConfetti = () => {
    try {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {
      // ignore
    }
  };

  // -------------------------------------------------------------
  // STRAIGHT MEASUREMENT HANDLERS
  // -------------------------------------------------------------
  const handleStraightClick = (coords: Point2D) => {
    if (!measurement.pointC) {
      setMeasurement({
        pointC: coords,
        pointD: null,
        measuredPixelDistance: null,
        estimatedDistanceMeters: null,
        isComplete: false,
      });
    } else if (!measurement.pointD) {
      const dist = calculatePixelDistance(measurement.pointC, coords);
      const mPerPx = calibration.metersPerPixel || 0.005;
      const estDist = Math.round(dist * mPerPx * 100) / 100;
      setMeasurement({
        pointC: measurement.pointC,
        pointD: coords,
        measuredPixelDistance: dist,
        estimatedDistanceMeters: estDist,
        isComplete: true,
      });
      fireConfetti();
    } else {
      // Reset to new point C
      setMeasurement({
        pointC: coords,
        pointD: null,
        measuredPixelDistance: null,
        estimatedDistanceMeters: null,
        isComplete: false,
      });
    }
  };

  // -------------------------------------------------------------
  // BENDING & CURVED PATH HANDLERS
  // -------------------------------------------------------------
  const handleBendingClick = (coords: Point2D) => {
    if (bendData.isComplete) {
      // Start fresh
      setBendData({
        points: [coords],
        totalPixelLength: null,
        totalMeterLength: null,
        chordPixelDistance: null,
        chordMeterDistance: null,
        maxDeflectionPixels: null,
        maxDeflectionMeters: null,
        bendingRatio: null,
        totalAngleDeg: null,
        segments: [],
        true3DLengthMeters: null,
        isComplete: false,
      });
      return;
    }

    const newPoints = [...bendData.points, coords];
    const mPerPx = calibration.metersPerPixel || 0.005;
    const analysis = calculateBendingAnalysis(
      newPoints,
      mPerPx,
      depthData,
      originalWidth,
      originalHeight
    );

    setBendData({
      points: newPoints,
      totalPixelLength: analysis.totalPixelLength,
      totalMeterLength: analysis.totalMeterLength,
      chordPixelDistance: analysis.chordPixelDistance,
      chordMeterDistance: analysis.chordMeterDistance,
      maxDeflectionPixels: analysis.maxDeflectionPixels,
      maxDeflectionMeters: analysis.maxDeflectionMeters,
      bendingRatio: analysis.bendingRatio,
      totalAngleDeg: analysis.totalAngleDeg,
      segments: analysis.segments,
      true3DLengthMeters: analysis.true3DLengthMeters,
      isComplete: false,
    });
  };

  const handleFinishBending = () => {
    if (bendData.points.length < 2) return;
    const mPerPx = calibration.metersPerPixel || 0.005;
    const analysis = calculateBendingAnalysis(
      bendData.points,
      mPerPx,
      depthData,
      originalWidth,
      originalHeight
    );

    setBendData((prev) => ({
      ...prev,
      ...analysis,
      isComplete: true,
    }));
    fireConfetti();
  };

  const handleUndoBendPoint = () => {
    if (bendData.points.length === 0) return;
    const newPoints = bendData.points.slice(0, -1);
    const mPerPx = calibration.metersPerPixel || 0.005;
    const analysis = calculateBendingAnalysis(
      newPoints,
      mPerPx,
      depthData,
      originalWidth,
      originalHeight
    );

    setBendData({
      points: newPoints,
      totalPixelLength: analysis.totalPixelLength,
      totalMeterLength: analysis.totalMeterLength,
      chordPixelDistance: analysis.chordPixelDistance,
      chordMeterDistance: analysis.chordMeterDistance,
      maxDeflectionPixels: analysis.maxDeflectionPixels,
      maxDeflectionMeters: analysis.maxDeflectionMeters,
      bendingRatio: analysis.bendingRatio,
      totalAngleDeg: analysis.totalAngleDeg,
      segments: analysis.segments,
      true3DLengthMeters: analysis.true3DLengthMeters,
      isComplete: false,
    });
  };

  // -------------------------------------------------------------
  // IRREGULAR AREA (POLYGON & FREEHAND) HANDLERS
  // -------------------------------------------------------------
  const finalizeAreaMetrics = (points: Point2D[], isClosed: boolean = true) => {
    if (points.length < 3) return;
    const mPerPx = calibration.metersPerPixel || 0.005;
    const pxArea = calculatePolygonArea(points);
    const meterArea = Math.round(pxArea * Math.pow(mPerPx, 2) * 1000) / 1000;
    const sqFeetArea = Math.round(meterArea * 10.7639 * 100) / 100;
    const sqCmArea = Math.round(meterArea * 10000);
    const pxPerimeter = calculatePolylinePerimeter(points, isClosed);
    const meterPerimeter = Math.round(pxPerimeter * mPerPx * 100) / 100;
    const bRect = calculateBoundingBox(points, mPerPx);
    const centroid = calculatePolygonCentroid(points);

    const { avgDepth, depthVariance } = sampleDepthInsidePolygon(
      points,
      depthData,
      originalWidth,
      originalHeight
    );

    setAreaData({
      points,
      drawMethod: areaData.drawMethod,
      pixelArea: Math.round(pxArea),
      meterArea,
      sqFeetArea,
      sqCmArea,
      pixelPerimeter: Math.round(pxPerimeter),
      meterPerimeter,
      boundingRect: bRect,
      centroid,
      avgDepth,
      depthVariance,
      isClosed,
      isComplete: true,
    });
    fireConfetti();
  };

  const handlePolygonClick = (coords: Point2D) => {
    if (areaData.isComplete) {
      // Start fresh
      setAreaData({
        points: [coords],
        drawMethod: 'polygon',
        pixelArea: null,
        meterArea: null,
        sqFeetArea: null,
        sqCmArea: null,
        pixelPerimeter: null,
        meterPerimeter: null,
        boundingRect: null,
        centroid: null,
        avgDepth: null,
        depthVariance: null,
        isClosed: false,
        isComplete: false,
      });
      return;
    }

    // Check if clicked near start point to close polygon automatically
    if (areaData.points.length >= 3) {
      const first = areaData.points[0];
      const distToFirst = calculatePixelDistance(first, coords);
      if (distToFirst < 25) {
        finalizeAreaMetrics(areaData.points, true);
        return;
      }
    }

    const newPoints = [...areaData.points, coords];
    const mPerPx = calibration.metersPerPixel || 0.005;
    const pxArea = calculatePolygonArea(newPoints);
    const meterArea = Math.round(pxArea * Math.pow(mPerPx, 2) * 1000) / 1000;
    const pxPerimeter = calculatePolylinePerimeter(newPoints, false);
    const meterPerimeter = Math.round(pxPerimeter * mPerPx * 100) / 100;

    setAreaData({
      ...areaData,
      points: newPoints,
      drawMethod: 'polygon',
      pixelArea: Math.round(pxArea),
      meterArea,
      pixelPerimeter: Math.round(pxPerimeter),
      meterPerimeter,
      isClosed: false,
      isComplete: false,
    });
  };

  const handleFinishPolygon = () => {
    if (areaData.points.length < 3) return;
    finalizeAreaMetrics(areaData.points, true);
  };

  const handleUndoAreaPoint = () => {
    if (areaData.points.length === 0) return;
    const newPoints = areaData.points.slice(0, -1);
    const mPerPx = calibration.metersPerPixel || 0.005;
    const pxArea = calculatePolygonArea(newPoints);
    const meterArea = Math.round(pxArea * Math.pow(mPerPx, 2) * 1000) / 1000;
    const pxPerimeter = calculatePolylinePerimeter(newPoints, false);
    const meterPerimeter = Math.round(pxPerimeter * mPerPx * 100) / 100;

    setAreaData({
      ...areaData,
      points: newPoints,
      pixelArea: Math.round(pxArea),
      meterArea,
      pixelPerimeter: Math.round(pxPerimeter),
      meterPerimeter,
      isClosed: false,
      isComplete: false,
    });
  };

  // Freehand Drag Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeStep !== 'measure' || currentMode !== 'irregular_area' || areaData.drawMethod !== 'freehand') {
      return;
    }
    if (!containerRef.current) return;
    const coords = getOriginalImageCoordinates(e, containerRef.current, originalWidth, originalHeight);
    setIsDrawingFreehand(true);
    setAreaData({
      points: [coords],
      drawMethod: 'freehand',
      pixelArea: null,
      meterArea: null,
      sqFeetArea: null,
      sqCmArea: null,
      pixelPerimeter: null,
      meterPerimeter: null,
      boundingRect: null,
      centroid: null,
      avgDepth: null,
      depthVariance: null,
      isClosed: false,
      isComplete: false,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const coords = getOriginalImageCoordinates(e, containerRef.current, originalWidth, originalHeight);
    setHoverCoord(coords);

    if (isDrawingFreehand && activeStep === 'measure' && currentMode === 'irregular_area' && areaData.drawMethod === 'freehand') {
      // Add point if distance from last point is >= 6 pixels to keep points smooth and lightweight
      const last = areaData.points[areaData.points.length - 1];
      if (!last || calculatePixelDistance(last, coords) >= 6) {
        setAreaData((prev) => ({
          ...prev,
          points: [...prev.points, coords],
        }));
      }
    }
  };

  const handleMouseUp = () => {
    if (isDrawingFreehand && areaData.drawMethod === 'freehand') {
      setIsDrawingFreehand(false);
      if (areaData.points.length >= 5) {
        finalizeAreaMetrics(areaData.points, true);
      }
    }
  };

  // Master image click dispatcher
  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const coords = getOriginalImageCoordinates(e, containerRef.current, originalWidth, originalHeight);

    if (activeStep === 'calibrate') {
      if (!calibration.pointA) {
        setCalibration((prev) => ({ ...prev, pointA: coords, pointB: null, isCalibrated: false }));
      } else if (!calibration.pointB) {
        const dist = calculatePixelDistance(calibration.pointA, coords);
        setCalibration((prev) => ({
          ...prev,
          pointB: coords,
          referencePixelDistance: dist,
        }));
      } else {
        setCalibration((prev) => ({
          ...prev,
          pointA: coords,
          pointB: null,
          referencePixelDistance: null,
          isCalibrated: false,
        }));
      }
    } else if (activeStep === 'measure') {
      if (currentMode === 'straight') {
        handleStraightClick(coords);
      } else if (currentMode === 'bending') {
        handleBendingClick(coords);
      } else if (currentMode === 'irregular_area' && areaData.drawMethod === 'polygon') {
        handlePolygonClick(coords);
      }
    }
  };

  const handleResetAllMeasurements = () => {
    setMeasurement({
      pointC: null,
      pointD: null,
      measuredPixelDistance: null,
      estimatedDistanceMeters: null,
      isComplete: false,
    });
    setBendData({
      points: [],
      totalPixelLength: null,
      totalMeterLength: null,
      chordPixelDistance: null,
      chordMeterDistance: null,
      maxDeflectionPixels: null,
      maxDeflectionMeters: null,
      bendingRatio: null,
      totalAngleDeg: null,
      segments: [],
      true3DLengthMeters: null,
      isComplete: false,
    });
    setAreaData({
      points: [],
      drawMethod: areaData.drawMethod,
      pixelArea: null,
      meterArea: null,
      sqFeetArea: null,
      sqCmArea: null,
      pixelPerimeter: null,
      meterPerimeter: null,
      boundingRect: null,
      centroid: null,
      avgDepth: null,
      depthVariance: null,
      isClosed: false,
      isComplete: false,
    });
  };

  // Compute live SVG spline string for bending or polygon string for area
  const bendSvgPath = bendData.points.length >= 2
    ? getSmoothSplinePath(bendData.points, originalWidth, originalHeight, false)
    : '';

  const areaSvgPath = areaData.points.length >= 2
    ? getSmoothSplinePath(areaData.points, originalWidth, originalHeight, areaData.isClosed)
    : '';

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Step Banner */}
      <div className="bg-white rounded-2xl border border-blue-100 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <Ruler className="w-6 h-6 text-blue-600" />
              <span>Real-World Spatial Measurement Suite</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Calibrate with a known reference object, then measure straight distances, bending curves, or irregular surface areas in meters.
            </p>
          </div>

          {/* Step Pill Indicators */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveStep('calibrate')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeStep === 'calibrate'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : calibration.isCalibrated
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">1</span>
              <span>Reference Calibration</span>
              {calibration.isCalibrated && <CheckCircle2 className="w-3.5 h-3.5 ml-0.5" />}
            </button>

            <ArrowRight className="w-3.5 h-3.5 text-slate-300" />

            <button
              onClick={() => {
                if (calibration.isCalibrated) setActiveStep('measure');
              }}
              disabled={!calibration.isCalibrated}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeStep === 'measure'
                  ? 'bg-blue-600 text-white shadow-xs cursor-pointer'
                  : calibration.isCalibrated
                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer'
                  : 'bg-slate-100 text-slate-400 opacity-60 cursor-not-allowed'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">2</span>
              <span>Measure Target</span>
              {(measurement.isComplete || bendData.isComplete || areaData.isComplete) && (
                <CheckCircle2 className="w-3.5 h-3.5 ml-0.5" />
              )}
            </button>
          </div>
        </div>

        {/* Step 1 & 2 Instructions */}
        <div className="pt-4 space-y-4">
          {activeStep === 'calibrate' ? (
            <div className="bg-blue-50/80 rounded-xl p-4 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase text-blue-900 tracking-wider">
                  Step 1: Reference Object Calibration
                </p>
                <p className="text-sm text-slate-800 font-medium">
                  {!calibration.pointA
                    ? '👉 Click Point A on an object whose real-world distance you already know.'
                    : !calibration.pointB
                    ? '👉 Click Point B to complete the reference segment.'
                    : '✅ Reference segment selected. Enter the known distance below.'}
                </p>
              </div>

              {calibration.pointA && calibration.pointB && !calibration.isCalibrated && (
                <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-blue-200 shadow-xs">
                  <span className="text-xs text-slate-600 font-semibold whitespace-nowrap">Known Real Distance:</span>
                  <div className="relative flex items-center">
                    <input
                      id="input-known-distance"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={knownDistanceInput}
                      onChange={(e) => setKnownDistanceInput(e.target.value)}
                      placeholder="1.00"
                      className="w-24 px-2 py-1 text-sm font-bold text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-right pr-6"
                    />
                    <span className="absolute right-2 text-xs font-bold text-slate-500">m</span>
                  </div>
                  <button
                    id="btn-confirm-calibration"
                    onClick={handleConfirmCalibration}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
                  >
                    Calibrate
                  </button>
                </div>
              )}

              {calibration.isCalibrated && (
                <div className="flex items-center gap-3">
                  <div className="text-xs text-emerald-800 font-semibold">
                    Scale: <span className="font-mono">{calibration.metersPerPixel?.toFixed(5)} m/px</span> ({calibration.knownDistanceMeters}m / {calibration.referencePixelDistance}px)
                  </div>
                  <button
                    onClick={handleRecalibrate}
                    className="text-xs text-blue-600 hover:underline font-semibold cursor-pointer"
                  >
                    Change Reference
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Step 2: Target Measurement with Mode Switcher */
            <div className="space-y-4">
              {/* Measurement Mode Selector */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Measurement Mode:
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    id="btn-mode-straight"
                    onClick={() => setMode('straight')}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      currentMode === 'straight'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    <Ruler className="w-4 h-4" />
                    <span>Straight Distance (2 Points)</span>
                  </button>

                  <button
                    id="btn-mode-bending"
                    onClick={() => setMode('bending')}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      currentMode === 'bending'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    <Spline className="w-4 h-4" />
                    <span>Bending & Curved Path</span>
                  </button>

                  <button
                    id="btn-mode-irregular-area"
                    onClick={() => setMode('irregular_area')}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      currentMode === 'irregular_area'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    <Hexagon className="w-4 h-4" />
                    <span>Irregular Area Coverage</span>
                  </button>
                </div>
              </div>

              {/* Mode-Specific Action Prompt & Subcontrols */}
              {currentMode === 'straight' && (
                <div className="bg-blue-50/90 rounded-xl p-4 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase text-blue-900 tracking-wider flex items-center gap-1.5">
                      <Ruler className="w-3.5 h-3.5 text-blue-600" />
                      Straight Distance Measurement
                    </p>
                    <p className="text-sm text-slate-800 font-medium">
                      {!measurement.pointC
                        ? '👉 Click Point C to start measuring.'
                        : !measurement.pointD
                        ? '👉 Click Point D to calculate distance in meters.'
                        : '🎉 Straight measurement complete! See details below.'}
                    </p>
                  </div>

                  {measurement.pointC && (
                    <button
                      onClick={() =>
                        setMeasurement({
                          pointC: null,
                          pointD: null,
                          measuredPixelDistance: null,
                          estimatedDistanceMeters: null,
                          isComplete: false,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset Points</span>
                    </button>
                  )}
                </div>
              )}

              {currentMode === 'bending' && (
                <div className="bg-indigo-50/90 rounded-xl p-4 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase text-indigo-950 tracking-wider flex items-center gap-1.5">
                      <Spline className="w-3.5 h-3.5 text-indigo-600" />
                      Bending & Curved Contour Measurement
                    </p>
                    <p className="text-sm text-slate-800 font-medium">
                      {bendData.points.length === 0
                        ? '👉 Click along any curved path, bent pipe, arch, or contour to place control points.'
                        : bendData.points.length === 1
                        ? '👉 Click next points along the curve.'
                        : bendData.isComplete
                        ? '🎉 Bending and curve analysis complete!'
                        : `👉 ${bendData.points.length} points placed (${bendData.totalMeterLength ?? 0}m). Click more points or click "Complete Bend".`}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {bendData.points.length > 0 && !bendData.isComplete && (
                      <>
                        <button
                          onClick={handleUndoBendPoint}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                        >
                          <Undo2 className="w-3 h-3" />
                          <span>Undo Point</span>
                        </button>
                        <button
                          id="btn-complete-bending"
                          onClick={handleFinishBending}
                          disabled={bendData.points.length < 2}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Complete Bend</span>
                        </button>
                      </>
                    )}

                    {bendData.isComplete && (
                      <button
                        onClick={() =>
                          setBendData({
                            points: [],
                            totalPixelLength: null,
                            totalMeterLength: null,
                            chordPixelDistance: null,
                            chordMeterDistance: null,
                            maxDeflectionPixels: null,
                            maxDeflectionMeters: null,
                            bendingRatio: null,
                            totalAngleDeg: null,
                            segments: [],
                            true3DLengthMeters: null,
                            isComplete: false,
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Measure New Curve</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {currentMode === 'irregular_area' && (
                <div className="bg-emerald-50/90 rounded-xl p-4 border border-emerald-200 flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-bold uppercase text-emerald-950 tracking-wider flex items-center gap-1.5">
                        <Hexagon className="w-3.5 h-3.5 text-emerald-600" />
                        Irregular Area & Perimeter Coverage
                      </p>
                      <p className="text-sm text-slate-800 font-medium">
                        {areaData.drawMethod === 'polygon' ? (
                          areaData.points.length === 0
                            ? '👉 Click around the perimeter of any irregular area to place boundary vertices.'
                            : areaData.isComplete
                            ? '🎉 Irregular area measured successfully!'
                            : `👉 ${areaData.points.length} vertices placed. Click next points or close the shape.`
                        ) : (
                          areaData.isComplete
                            ? '🎉 Freehand lasso area measured successfully!'
                            : '👉 Click and drag your mouse/touch across the image to trace any irregular shape.'
                        )}
                      </p>
                    </div>

                    {/* Method Selector: Click Polygon vs Freehand Lasso */}
                    <div className="inline-flex p-1 bg-white rounded-xl border border-emerald-200 text-xs shrink-0 shadow-2xs">
                      <button
                        onClick={() =>
                          setAreaData((prev) => ({
                            ...prev,
                            drawMethod: 'polygon',
                            points: prev.isComplete ? prev.points : [],
                          }))
                        }
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                          areaData.drawMethod === 'polygon'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <MousePointerClick className="w-3.5 h-3.5" />
                        <span>Click Vertices</span>
                      </button>

                      <button
                        onClick={() =>
                          setAreaData((prev) => ({
                            ...prev,
                            drawMethod: 'freehand',
                            points: prev.isComplete ? prev.points : [],
                          }))
                        }
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                          areaData.drawMethod === 'freehand'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Freehand Lasso</span>
                      </button>
                    </div>
                  </div>

                  {/* Polygon action buttons */}
                  {areaData.drawMethod === 'polygon' && areaData.points.length > 0 && !areaData.isComplete && (
                    <div className="flex items-center gap-2 pt-1 border-t border-emerald-100 justify-end">
                      <button
                        onClick={handleUndoAreaPoint}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                      >
                        <Undo2 className="w-3 h-3" />
                        <span>Undo Vertex</span>
                      </button>

                      <button
                        id="btn-close-area"
                        onClick={handleFinishPolygon}
                        disabled={areaData.points.length < 3}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Close & Calculate Area</span>
                      </button>
                    </div>
                  )}

                  {areaData.isComplete && (
                    <div className="flex items-center gap-2 pt-1 border-t border-emerald-100 justify-end">
                      <button
                        onClick={() =>
                          setAreaData({
                            points: [],
                            drawMethod: areaData.drawMethod,
                            pixelArea: null,
                            meterArea: null,
                            sqFeetArea: null,
                            sqCmArea: null,
                            pixelPerimeter: null,
                            meterPerimeter: null,
                            boundingRect: null,
                            centroid: null,
                            avgDepth: null,
                            depthVariance: null,
                            isClosed: false,
                            isComplete: false,
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Cover Another Area</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Interactive Original Image Canvas Display */}
      <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3 px-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Maximize2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Interactive Viewport</span>
          </span>
          <span className="text-xs text-blue-600 font-semibold">
            {activeStep === 'calibrate'
              ? 'Calibration Mode'
              : currentMode === 'straight'
              ? 'Straight 2-Point Mode'
              : currentMode === 'bending'
              ? 'Bending & Curve Mode'
              : 'Irregular Area Mode'}
          </span>
        </div>

        <div
          ref={containerRef}
          onClick={handleImageClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className={`relative rounded-xl overflow-hidden bg-slate-950 border border-slate-300 aspect-16/10 sm:aspect-16/9 flex items-center justify-center select-none ${
            currentMode === 'irregular_area' && areaData.drawMethod === 'freehand'
              ? 'cursor-pencil'
              : 'cursor-crosshair'
          }`}
        >
          {/* Base Original Image */}
          <img
            src={imageSrc}
            alt="Measurement Canvas"
            className="w-full h-full object-contain pointer-events-none"
          />

          {/* SVG Overlay to Draw Points, Lines, Bends, and Irregular Polygons */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {/* 1. Reference Line A -> B */}
            {calibration.pointA && (
              <circle
                cx={`${(calibration.pointA.x / originalWidth) * 100}%`}
                cy={`${(calibration.pointA.y / originalHeight) * 100}%`}
                r="7"
                className="fill-blue-500 stroke-2 stroke-white shadow-lg"
              />
            )}
            {calibration.pointB && (
              <circle
                cx={`${(calibration.pointB.x / originalWidth) * 100}%`}
                cy={`${(calibration.pointB.y / originalHeight) * 100}%`}
                r="7"
                className="fill-blue-500 stroke-2 stroke-white shadow-lg"
              />
            )}
            {calibration.pointA && calibration.pointB && (
              <>
                <line
                  x1={`${(calibration.pointA.x / originalWidth) * 100}%`}
                  y1={`${(calibration.pointA.y / originalHeight) * 100}%`}
                  x2={`${(calibration.pointB.x / originalWidth) * 100}%`}
                  y2={`${(calibration.pointB.y / originalHeight) * 100}%`}
                  className="stroke-blue-500 stroke-[3] stroke-dasharray-2"
                />
                <text
                  x={`${((calibration.pointA.x + calibration.pointB.x) / 2 / originalWidth) * 100}%`}
                  y={`${((calibration.pointA.y + calibration.pointB.y) / 2 / originalHeight) * 100}%`}
                  fill="#ffffff"
                  stroke="#1e3a8a"
                  strokeWidth="3"
                  paintOrder="stroke fill"
                  fontSize="13"
                  fontWeight="bold"
                  textAnchor="middle"
                  dy="-8"
                >
                  Ref: {calibration.knownDistanceMeters ? `${calibration.knownDistanceMeters} m` : 'A ── B'} ({calibration.referencePixelDistance}px)
                </text>
              </>
            )}

            {/* 2. STRAIGHT LINE MODE (C -> D) */}
            {activeStep === 'measure' && currentMode === 'straight' && (
              <>
                {measurement.pointC && (
                  <circle
                    cx={`${(measurement.pointC.x / originalWidth) * 100}%`}
                    cy={`${(measurement.pointC.y / originalHeight) * 100}%`}
                    r="7"
                    className="fill-emerald-500 stroke-2 stroke-white shadow-lg"
                  />
                )}
                {measurement.pointD && (
                  <circle
                    cx={`${(measurement.pointD.x / originalWidth) * 100}%`}
                    cy={`${(measurement.pointD.y / originalHeight) * 100}%`}
                    r="7"
                    className="fill-emerald-500 stroke-2 stroke-white shadow-lg"
                  />
                )}
                {measurement.pointC && measurement.pointD && (
                  <>
                    <line
                      x1={`${(measurement.pointC.x / originalWidth) * 100}%`}
                      y1={`${(measurement.pointC.y / originalHeight) * 100}%`}
                      x2={`${(measurement.pointD.x / originalWidth) * 100}%`}
                      y2={`${(measurement.pointD.y / originalHeight) * 100}%`}
                      className="stroke-emerald-500 stroke-[3.5]"
                    />
                    <text
                      x={`${((measurement.pointC.x + measurement.pointD.x) / 2 / originalWidth) * 100}%`}
                      y={`${((measurement.pointC.y + measurement.pointD.y) / 2 / originalHeight) * 100}%`}
                      fill="#ffffff"
                      stroke="#065f46"
                      strokeWidth="3"
                      paintOrder="stroke fill"
                      fontSize="14"
                      fontWeight="bold"
                      textAnchor="middle"
                      dy="-10"
                    >
                      📏 {measurement.estimatedDistanceMeters} m ({measurement.measuredPixelDistance}px)
                    </text>
                  </>
                )}
              </>
            )}

            {/* 3. BENDING & CURVE MODE */}
            {activeStep === 'measure' && currentMode === 'bending' && (
              <>
                {/* Straight Chord line (dashed sky blue) */}
                {bendData.points.length >= 2 && (
                  <line
                    x1={`${(bendData.points[0].x / originalWidth) * 100}%`}
                    y1={`${(bendData.points[0].y / originalHeight) * 100}%`}
                    x2={`${(bendData.points[bendData.points.length - 1].x / originalWidth) * 100}%`}
                    y2={`${(bendData.points[bendData.points.length - 1].y / originalHeight) * 100}%`}
                    className="stroke-sky-400 stroke-2 stroke-dasharray-4 opacity-80"
                  />
                )}

                {/* Curved Spline Path */}
                {bendSvgPath && (
                  <path
                    d={bendSvgPath}
                    fill="none"
                    className="stroke-indigo-500 stroke-[3.5] filter drop-shadow-md"
                  />
                )}

                {/* Point pins with index numbers */}
                {bendData.points.map((p, idx) => (
                  <g key={idx}>
                    <circle
                      cx={`${(p.x / originalWidth) * 100}%`}
                      cy={`${(p.y / originalHeight) * 100}%`}
                      r={idx === 0 || idx === bendData.points.length - 1 ? '7' : '5.5'}
                      className={
                        idx === 0
                          ? 'fill-indigo-600 stroke-2 stroke-white'
                          : idx === bendData.points.length - 1
                          ? 'fill-rose-500 stroke-2 stroke-white'
                          : 'fill-indigo-400 stroke-1.5 stroke-white'
                      }
                    />
                    <text
                      x={`${(p.x / originalWidth) * 100}%`}
                      y={`${(p.y / originalHeight) * 100}%`}
                      fill="#ffffff"
                      stroke="#312e81"
                      strokeWidth="2"
                      paintOrder="stroke fill"
                      fontSize="10"
                      fontWeight="bold"
                      textAnchor="middle"
                      dy="-8"
                    >
                      {idx + 1}
                    </text>
                  </g>
                ))}

                {/* Midpoint Arc Length Label */}
                {bendData.points.length >= 2 && (
                  <text
                    x={`${((bendData.points[0].x + bendData.points[bendData.points.length - 1].x) / 2 / originalWidth) * 100}%`}
                    y={`${((bendData.points[0].y + bendData.points[bendData.points.length - 1].y) / 2 / originalHeight) * 100}%`}
                    fill="#ffffff"
                    stroke="#3730a3"
                    strokeWidth="3.5"
                    paintOrder="stroke fill"
                    fontSize="13"
                    fontWeight="bold"
                    textAnchor="middle"
                    dy="-12"
                  >
                    〰️ Arc: {bendData.totalMeterLength} m | Chord: {bendData.chordMeterDistance} m
                  </text>
                )}
              </>
            )}

            {/* 4. IRREGULAR AREA MODE */}
            {activeStep === 'measure' && currentMode === 'irregular_area' && (
              <>
                {/* Bounding box outline */}
                {areaData.boundingRect && areaData.isComplete && (
                  <rect
                    x={`${(areaData.boundingRect.minX / originalWidth) * 100}%`}
                    y={`${(areaData.boundingRect.minY / originalHeight) * 100}%`}
                    width={`${((areaData.boundingRect.maxX - areaData.boundingRect.minX) / originalWidth) * 100}%`}
                    height={`${((areaData.boundingRect.maxY - areaData.boundingRect.minY) / originalHeight) * 100}%`}
                    fill="none"
                    className="stroke-amber-400 stroke-1 stroke-dasharray-4 opacity-50"
                  />
                )}

                {/* Filled Polygon Path */}
                {areaSvgPath && (
                  <path
                    d={areaSvgPath}
                    fill={areaData.isClosed ? 'rgba(16, 185, 129, 0.28)' : 'none'}
                    className={
                      areaData.isClosed
                        ? 'stroke-emerald-500 stroke-[3] filter drop-shadow-sm'
                        : 'stroke-emerald-400 stroke-2 stroke-dasharray-3'
                    }
                  />
                )}

                {/* Vertices Pins */}
                {areaData.points.map((p, idx) => (
                  <g key={idx}>
                    <circle
                      cx={`${(p.x / originalWidth) * 100}%`}
                      cy={`${(p.y / originalHeight) * 100}%`}
                      r={idx === 0 ? '7' : '4.5'}
                      className={
                        idx === 0
                          ? 'fill-emerald-600 stroke-2 stroke-white'
                          : 'fill-emerald-400 stroke-1.5 stroke-white'
                      }
                    />
                    {idx === 0 && !areaData.isComplete && (
                      <text
                        x={`${(p.x / originalWidth) * 100}%`}
                        y={`${(p.y / originalHeight) * 100}%`}
                        fill="#ffffff"
                        stroke="#064e3b"
                        strokeWidth="2.5"
                        paintOrder="stroke fill"
                        fontSize="10"
                        fontWeight="bold"
                        textAnchor="middle"
                        dy="-9"
                      >
                        Start
                      </text>
                    )}
                  </g>
                ))}

                {/* Centroid Badge */}
                {areaData.centroid && areaData.isComplete && (
                  <g>
                    <circle
                      cx={`${(areaData.centroid.x / originalWidth) * 100}%`}
                      cy={`${(areaData.centroid.y / originalHeight) * 100}%`}
                      r="5"
                      className="fill-amber-400 stroke-2 stroke-slate-900"
                    />
                    <text
                      x={`${(areaData.centroid.x / originalWidth) * 100}%`}
                      y={`${(areaData.centroid.y / originalHeight) * 100}%`}
                      fill="#ffffff"
                      stroke="#065f46"
                      strokeWidth="3.5"
                      paintOrder="stroke fill"
                      fontSize="14"
                      fontWeight="bold"
                      textAnchor="middle"
                      dy="-10"
                    >
                      📐 {areaData.meterArea} m² ({areaData.sqFeetArea} sq ft)
                    </text>
                  </g>
                )}
              </>
            )}
          </svg>

          {/* Coordinate indicator helper pill */}
          <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur text-white text-[11px] px-3 py-1.5 rounded-lg pointer-events-none flex items-center gap-2">
            <span>Image: {originalWidth} × {originalHeight} px</span>
            <span>•</span>
            <span>
              {activeStep === 'calibrate'
                ? !calibration.pointA
                  ? 'Click Point A'
                  : !calibration.pointB
                  ? 'Click Point B'
                  : 'A & B Calibrated'
                : currentMode === 'straight'
                ? !measurement.pointC
                  ? 'Click Point C'
                  : !measurement.pointD
                  ? 'Click Point D'
                  : 'Distance Calculated'
                : currentMode === 'bending'
                ? `${bendData.points.length} Bend Points`
                : `${areaData.points.length} Area Vertices (${areaData.drawMethod})`}
            </span>
            {hoverCoord && (
              <>
                <span>•</span>
                <span className="font-mono text-slate-300">
                  X:{hoverCoord.x} Y:{hoverCoord.y}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* RESULT CARDS ACCORDING TO ACTIVE MEASUREMENT MODE */}
      {/* ------------------------------------------------------------- */}

      {/* RESULT 1: STRAIGHT LINE MEASUREMENT CARD */}
      {currentMode === 'straight' && measurement.isComplete && (
        <div className="bg-white rounded-2xl border-2 border-emerald-200 p-6 shadow-md space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-100">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                📏
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  STRAIGHT DISTANCE MEASUREMENT
                </h3>
                <p className="text-xs text-slate-500">
                  Calculated based on your reference calibration
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setMeasurement({
                    pointC: null,
                    pointD: null,
                    measuredPixelDistance: null,
                    estimatedDistanceMeters: null,
                    isComplete: false,
                  })
                }
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Measure Again
              </button>
            </div>
          </div>

          {/* Prominent Estimated Distance Highlight */}
          <div className="bg-gradient-to-br from-emerald-500 to-teal-700 rounded-2xl p-6 text-white text-center shadow-lg">
            <span className="text-xs uppercase tracking-widest font-semibold text-emerald-100">
              Estimated Straight Distance
            </span>
            <div className="text-4xl sm:text-5xl font-black tracking-tight my-1">
              {measurement.estimatedDistanceMeters} m
            </div>
            <span className="text-xs text-emerald-100">
              ({measurement.measuredPixelDistance} measured pixels • {(measurement.estimatedDistanceMeters! * 3.28084).toFixed(2)} ft)
            </span>
          </div>

          {/* Metric Details Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-slate-500 block mb-0.5">Reference Known</span>
              <span className="text-sm font-bold text-slate-900">{calibration.knownDistanceMeters?.toFixed(2)} m</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-slate-500 block mb-0.5">Reference Pixels</span>
              <span className="text-sm font-bold text-slate-900">{calibration.referencePixelDistance} px</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-slate-500 block mb-0.5">Measured Pixels</span>
              <span className="text-sm font-bold text-slate-900">{measurement.measuredPixelDistance} px</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-slate-500 block mb-0.5">Scale Factor</span>
              <span className="text-sm font-bold text-slate-900 font-mono">
                {calibration.metersPerPixel?.toFixed(5)} m/px
              </span>
            </div>
          </div>
        </div>
      )}

      {/* RESULT 2: BENDING & CURVE MEASUREMENT CARD */}
      {currentMode === 'bending' && (bendData.isComplete || bendData.points.length >= 2) && (
        <div className="bg-white rounded-2xl border-2 border-indigo-200 p-6 shadow-md space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-100">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                〰️
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  BENDING & CURVED CONTOUR ANALYSIS
                </h3>
                <p className="text-xs text-slate-500">
                  Total arc length, straight chord distance, and deflection camber
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!bendData.isComplete ? (
                <button
                  onClick={handleFinishBending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Finalize Bend
                </button>
              ) : (
                <button
                  onClick={() =>
                    setBendData({
                      points: [],
                      totalPixelLength: null,
                      totalMeterLength: null,
                      chordPixelDistance: null,
                      chordMeterDistance: null,
                      maxDeflectionPixels: null,
                      maxDeflectionMeters: null,
                      bendingRatio: null,
                      totalAngleDeg: null,
                      segments: [],
                      true3DLengthMeters: null,
                      isComplete: false,
                    })
                  }
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Measure New Curve
                </button>
              )}
            </div>
          </div>

          {/* Primary Metrics Duo: Arc Length vs Straight Chord */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-5 text-white text-center shadow-md">
              <span className="text-xs uppercase tracking-widest font-semibold text-indigo-200">
                Total Curved Arc Length
              </span>
              <div className="text-3xl sm:text-4xl font-black tracking-tight my-1">
                {bendData.totalMeterLength ?? 0} m
              </div>
              <span className="text-xs text-indigo-200">
                {((bendData.totalMeterLength ?? 0) * 3.28084).toFixed(2)} ft • {bendData.totalPixelLength} px
              </span>
            </div>

            <div className="bg-gradient-to-br from-sky-600 to-blue-800 rounded-2xl p-5 text-white text-center shadow-md">
              <span className="text-xs uppercase tracking-widest font-semibold text-sky-200">
                Straight Chord Distance (Start ↔ End)
              </span>
              <div className="text-3xl sm:text-4xl font-black tracking-tight my-1">
                {bendData.chordMeterDistance ?? 0} m
              </div>
              <span className="text-xs text-sky-200">
                {((bendData.chordMeterDistance ?? 0) * 3.28084).toFixed(2)} ft • {bendData.chordPixelDistance} px
              </span>
            </div>
          </div>

          {/* Advanced Bending Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100">
              <span className="text-indigo-900/70 block mb-0.5 font-medium">Max Deflection (Sagitta)</span>
              <span className="text-sm font-bold text-indigo-950 font-mono">
                {bendData.maxDeflectionMeters !== null
                  ? `${(bendData.maxDeflectionMeters * 100).toFixed(1)} cm (${bendData.maxDeflectionMeters} m)`
                  : 'N/A'}
              </span>
            </div>

            <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100">
              <span className="text-indigo-900/70 block mb-0.5 font-medium">Bending Ratio (Arc / Chord)</span>
              <span className="text-sm font-bold text-indigo-950 font-mono">
                {bendData.bendingRatio !== null ? `${bendData.bendingRatio}×` : '1.0×'}
              </span>
            </div>

            <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100">
              <span className="text-indigo-900/70 block mb-0.5 font-medium">Cumulative Bend Angle</span>
              <span className="text-sm font-bold text-indigo-950 font-mono">
                {bendData.totalAngleDeg !== null ? `${bendData.totalAngleDeg}°` : '0°'}
              </span>
            </div>

            <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100">
              <span className="text-indigo-900/70 block mb-0.5 font-medium">3D True Path Length</span>
              <span className="text-sm font-bold text-indigo-950 font-mono">
                {bendData.true3DLengthMeters ? `${bendData.true3DLengthMeters} m` : `${bendData.totalMeterLength} m`}
              </span>
            </div>
          </div>

          {/* Segment Details Breakdown Table */}
          {bendData.segments.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Segment-by-Segment Curve Breakdown ({bendData.segments.length} segments)
              </span>
              <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2 pl-3">Segment</th>
                      <th className="p-2">Start (X,Y)</th>
                      <th className="p-2">End (X,Y)</th>
                      <th className="p-2">Length (m)</th>
                      <th className="p-2 pr-3">Bend Turn (°)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {bendData.segments.map((seg, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80">
                        <td className="p-2 pl-3 font-sans font-semibold text-indigo-700">
                          {idx + 1} ➔ {idx + 2}
                        </td>
                        <td className="p-2 text-slate-600">({seg.p1.x}, {seg.p1.y})</td>
                        <td className="p-2 text-slate-600">({seg.p2.x}, {seg.p2.y})</td>
                        <td className="p-2 font-bold text-slate-900">{seg.meterDistance} m</td>
                        <td className="p-2 pr-3 text-slate-700">{seg.angleDeg > 0 ? `${seg.angleDeg}°` : '─'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* RESULT 3: IRREGULAR AREA MEASUREMENT CARD */}
      {currentMode === 'irregular_area' && (areaData.isComplete || areaData.points.length >= 3) && (
        <div className="bg-white rounded-2xl border-2 border-emerald-200 p-6 shadow-md space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-100">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                📐
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  IRREGULAR AREA & SURFACE COVERAGE
                </h3>
                <p className="text-xs text-slate-500">
                  Measured enclosed area using Surveyor&apos;s polygon calculation
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!areaData.isComplete ? (
                <button
                  onClick={handleFinishPolygon}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Close & Calculate
                </button>
              ) : (
                <button
                  onClick={() =>
                    setAreaData({
                      points: [],
                      drawMethod: areaData.drawMethod,
                      pixelArea: null,
                      meterArea: null,
                      sqFeetArea: null,
                      sqCmArea: null,
                      pixelPerimeter: null,
                      meterPerimeter: null,
                      boundingRect: null,
                      centroid: null,
                      avgDepth: null,
                      depthVariance: null,
                      isClosed: false,
                      isComplete: false,
                    })
                  }
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Cover Another Area
                </button>
              )}
            </div>
          </div>

          {/* Primary Area & Perimeter Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-emerald-600 to-teal-800 rounded-2xl p-5 text-white text-center shadow-md">
              <span className="text-xs uppercase tracking-widest font-semibold text-emerald-200">
                Enclosed Surface Area
              </span>
              <div className="text-3xl sm:text-4xl font-black tracking-tight my-1">
                {areaData.meterArea ?? 0} m²
              </div>
              <span className="text-xs text-emerald-200">
                {areaData.sqFeetArea ?? 0} sq ft • {areaData.sqCmArea?.toLocaleString() ?? 0} cm²
              </span>
            </div>

            <div className="bg-gradient-to-br from-teal-700 to-slate-900 rounded-2xl p-5 text-white text-center shadow-md">
              <span className="text-xs uppercase tracking-widest font-semibold text-teal-200">
                Total Boundary Perimeter
              </span>
              <div className="text-3xl sm:text-4xl font-black tracking-tight my-1">
                {areaData.meterPerimeter ?? 0} m
              </div>
              <span className="text-xs text-teal-200">
                {((areaData.meterPerimeter ?? 0) * 3.28084).toFixed(2)} ft • {areaData.pixelPerimeter} px
              </span>
            </div>
          </div>

          {/* Area Properties Details Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-100">
              <span className="text-emerald-900/70 block mb-0.5 font-medium">Bounding Width</span>
              <span className="text-sm font-bold text-emerald-950 font-mono">
                {areaData.boundingRect ? `${areaData.boundingRect.widthMeters} m` : 'N/A'}
              </span>
            </div>

            <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-100">
              <span className="text-emerald-900/70 block mb-0.5 font-medium">Bounding Height</span>
              <span className="text-sm font-bold text-emerald-950 font-mono">
                {areaData.boundingRect ? `${areaData.boundingRect.heightMeters} m` : 'N/A'}
              </span>
            </div>

            <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-100">
              <span className="text-emerald-900/70 block mb-0.5 font-medium">Centroid Point</span>
              <span className="text-sm font-bold text-emerald-950 font-mono">
                {areaData.centroid ? `X:${areaData.centroid.x}, Y:${areaData.centroid.y}` : 'N/A'}
              </span>
            </div>

            <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-100">
              <span className="text-emerald-900/70 block mb-0.5 font-medium">Avg Relative Depth</span>
              <span className="text-sm font-bold text-emerald-950 font-mono">
                {areaData.avgDepth !== null ? `${Math.round(areaData.avgDepth * 100)}% (±${Math.round((areaData.depthVariance ?? 0) * 100)}%)` : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Accuracy & Monocular Depth Disclaimer */}
      <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4 sm:p-5 flex items-start gap-3 text-amber-900 text-xs leading-relaxed">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block text-sm text-amber-950 mb-1">
            Measurement & Bending Accuracy Disclaimer
          </span>
          <p className="mb-1 text-slate-700">
            &ldquo;Measurement and area calculations are calibrated image-based estimates. Accuracy depends on the precision of the reference object calibration, lens perspective, image distortion, and planar orientation.&rdquo;
          </p>
          <p className="text-slate-600">
            For critical construction or physical fabrication tasks, always verify dimensions with physical laser measures or direct instruments.
          </p>
        </div>
      </div>
    </div>
  );
};
