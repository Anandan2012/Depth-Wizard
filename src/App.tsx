/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { LandingHero } from './components/LandingHero';
import { ImageUploader } from './components/ImageUploader';
import { DepthAnalysisView } from './components/DepthAnalysisView';
import { MeasurementTool } from './components/MeasurementTool';
import { ThreeDDepthViewer } from './components/ThreeDDepthViewer';
import { FlyModeViewer } from './components/FlyModeViewer';
import { ExportModal } from './components/ExportModal';
import { HelpGuideModal } from './components/HelpGuideModal';
import {
  CalibrationData,
  DepthAnalysisResult,
  DepthColorMap,
  DepthMapData,
  MeasurementData,
  BendMeasurementData,
  AreaMeasurementData,
  MeasurementType,
} from './types';
import { computeMonocularDepth } from './utils/depthEngine';
import { analyzeDepthWithAI } from './services/geminiDepth';
import { SampleImage } from './utils/sampleImages';
import { Layers, Ruler, Eye, Compass, Sparkles, ArrowRight, RotateCcw, Spline, Hexagon } from 'lucide-react';

export default function App() {
  // Image & Upload state
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageWidth, setImageWidth] = useState<number>(0);
  const [imageHeight, setImageHeight] = useState<number>(0);
  const [rotation, setRotation] = useState<number>(0);

  // Depth data & AI Analysis
  const [depthData, setDepthData] = useState<DepthMapData | null>(null);
  const [analysisResult, setAnalysisResult] = useState<DepthAnalysisResult | null>(null);
  const [isProcessingDepth, setIsProcessingDepth] = useState<boolean>(false);

  // Visualization settings
  const [activeColorMap, setActiveColorMap] = useState<DepthColorMap>('turbo');
  const [lensPosition, setLensPosition] = useState<number>(0.5); // 0.0 to 1.0 (0% to 100%)
  const [lensEnabled, setLensEnabled] = useState<boolean>(false);

  // Active view tab
  const [activeTab, setActiveTab] = useState<'analyze' | 'measure' | '3d' | 'fly'>('analyze');

  // Active measurement mode
  const [measurementMode, setMeasurementMode] = useState<MeasurementType>('straight');

  // Calibration & Measurement states
  const [calibration, setCalibration] = useState<CalibrationData>({
    pointA: null,
    pointB: null,
    referencePixelDistance: null,
    knownDistanceMeters: null,
    metersPerPixel: null,
    isCalibrated: false,
  });

  const [measurement, setMeasurement] = useState<MeasurementData>({
    pointC: null,
    pointD: null,
    measuredPixelDistance: null,
    estimatedDistanceMeters: null,
    isComplete: false,
  });

  const [bendMeasurement, setBendMeasurement] = useState<BendMeasurementData>({
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

  const [areaMeasurement, setAreaMeasurement] = useState<AreaMeasurementData>({
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

  // Modals
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);

  // Handle image file selection
  const handleImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        setImageSrc(src);
        setImageWidth(img.naturalWidth || img.width);
        setImageHeight(img.naturalHeight || img.height);
        setRotation(0);
        setDepthData(null);
        setAnalysisResult(null);
        handleResetMeasurement();
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  // Handle preset sample selection
  const handleSelectSample = (sample: SampleImage) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImageSrc(sample.url);
      setImageWidth(sample.width);
      setImageHeight(sample.height);
      setRotation(0);
      setDepthData(null);
      setAnalysisResult(null);
      handleResetMeasurement();
    };
    img.src = sample.url;
  };

  // Rotation controls
  const handleRotateLeft = () => setRotation((prev) => (prev - 90) % 360);
  const handleRotateRight = () => setRotation((prev) => (prev + 90) % 360);
  const handleResetRotation = () => setRotation(0);

  // Reset measurement only
  const handleResetMeasurement = () => {
    setCalibration({
      pointA: null,
      pointB: null,
      referencePixelDistance: null,
      knownDistanceMeters: null,
      metersPerPixel: null,
      isCalibrated: false,
    });
    setMeasurement({
      pointC: null,
      pointD: null,
      measuredPixelDistance: null,
      estimatedDistanceMeters: null,
      isComplete: false,
    });
    setBendMeasurement({
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
    setAreaMeasurement({
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
  };

  // FEATURE 15 — FULL RESET PROJECT
  const handleResetProject = () => {
    setImageSrc(null);
    setImageWidth(0);
    setImageHeight(0);
    setRotation(0);
    setDepthData(null);
    setAnalysisResult(null);
    setActiveTab('analyze');
    handleResetMeasurement();
  };

  // FEATURE 2 — AI DEPTH GENERATION
  const handleGenerateDepth = async () => {
    if (!imageSrc) return;
    setIsProcessingDepth(true);

    try {
      // 1. Create an HTMLImageElement with rotation applied if any
      const img = new Image();
      img.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = imageSrc;
      });

      // If rotated, render rotated image to offscreen canvas first
      let processableImg = img;
      if (rotation !== 0) {
        const rad = (rotation * Math.PI) / 180;
        const sin = Math.abs(Math.sin(rad));
        const cos = Math.abs(Math.cos(rad));
        const rotW = Math.round(img.width * cos + img.height * sin);
        const rotH = Math.round(img.width * sin + img.height * cos);

        const rotCanvas = document.createElement('canvas');
        rotCanvas.width = rotW;
        rotCanvas.height = rotH;
        const rotCtx = rotCanvas.getContext('2d')!;
        rotCtx.translate(rotW / 2, rotH / 2);
        rotCtx.rotate(rad);
        rotCtx.drawImage(img, -img.width / 2, -img.height / 2);

        const rotatedSrc = rotCanvas.toDataURL('image/png');
        const rotImg = new Image();
        await new Promise<void>((resolve) => {
          rotImg.onload = () => resolve();
          rotImg.src = rotatedSrc;
        });
        processableImg = rotImg;
        setImageWidth(rotW);
        setImageHeight(rotH);
      }

      // 2. Compute high-fidelity monocular depth map
      const computedDepth = await computeMonocularDepth(processableImg);
      setDepthData(computedDepth);

      // 3. Call AI Depth Scene Analysis & Confidence in parallel
      analyzeDepthWithAI(imageSrc).then((aiAnalysis) => {
        setAnalysisResult(aiAnalysis);
      });

      setActiveTab('analyze');
    } catch (err) {
      console.error('Error generating depth map:', err);
    } finally {
      setIsProcessingDepth(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Navigation Header */}
      <Navbar
        hasImage={!!imageSrc}
        hasDepth={!!depthData}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onReset={handleResetProject}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenHelp={() => setIsHelpOpen(true)}
      />

      {/* Main App Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
        {!imageSrc ? (
          /* Landing Screen & Feature Showcase */
          <>
            <LandingHero
              onSelectSample={handleSelectSample}
              onTriggerUpload={() => {
                const input = document.getElementById('file-upload-input');
                if (input) input.click();
              }}
            />
            <ImageUploader
              imageSrc={imageSrc}
              imageWidth={imageWidth}
              imageHeight={imageHeight}
              rotation={rotation}
              isProcessing={isProcessingDepth}
              onImageSelected={handleImageFile}
              onRotateLeft={handleRotateLeft}
              onRotateRight={handleRotateRight}
              onResetRotation={handleResetRotation}
              onGenerateDepth={handleGenerateDepth}
            />
          </>
        ) : !depthData ? (
          /* Image Uploaded, Ready for Depth Generation */
          <div className="space-y-6">
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold text-slate-900">
                Step 1: Verify & Generate AI Depth
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Rotate your image if necessary, then click &ldquo;Generate Depth&rdquo; to start the AI analysis.
              </p>
            </div>

            <ImageUploader
              imageSrc={imageSrc}
              imageWidth={imageWidth}
              imageHeight={imageHeight}
              rotation={rotation}
              isProcessing={isProcessingDepth}
              onImageSelected={handleImageFile}
              onRotateLeft={handleRotateLeft}
              onRotateRight={handleRotateRight}
              onResetRotation={handleResetRotation}
              onGenerateDepth={handleGenerateDepth}
            />
          </div>
        ) : (
          /* Depth Map Generated: Full Workspace with Step-by-Step Tabs */
          <div className="space-y-6">
            {/* Step Navigation Pill Bar for Mobile & Quick Access */}
            <div className="flex items-center justify-between bg-white p-2 sm:p-3 rounded-2xl border border-blue-100 shadow-xs overflow-x-auto">
              <div className="flex items-center gap-2">
                <button
                  id="tab-btn-depth-analysis"
                  onClick={() => setActiveTab('analyze')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                    activeTab === 'analyze'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>1. AI Depth & Lens</span>
                </button>

                <button
                  id="tab-btn-click-measure"
                  onClick={() => setActiveTab('measure')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                    activeTab === 'measure'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : calibration.isCalibrated
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <Ruler className="w-4 h-4" />
                  <span>2. Click & Measure</span>
                  {measurement.isComplete && (
                    <span className="bg-emerald-200 text-emerald-900 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                      {measurement.estimatedDistanceMeters}m
                    </span>
                  )}
                  {bendMeasurement.isComplete && (
                    <span className="bg-indigo-200 text-indigo-950 text-[10px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                      <Spline className="w-2.5 h-2.5" />
                      {bendMeasurement.totalMeterLength}m
                    </span>
                  )}
                  {areaMeasurement.isComplete && (
                    <span className="bg-emerald-200 text-emerald-950 text-[10px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                      <Hexagon className="w-2.5 h-2.5" />
                      {areaMeasurement.meterArea}m²
                    </span>
                  )}
                </button>

                <button
                  id="tab-btn-3d-view"
                  onClick={() => setActiveTab('3d')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                    activeTab === '3d'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  <span>3. 3D Depth View</span>
                </button>

                <button
                  id="tab-btn-fly-mode"
                  onClick={() => setActiveTab('fly')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                    activeTab === 'fly'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                  }`}
                >
                  <Compass className="w-4 h-4" />
                  <span>4. ✈️ Fly Mode</span>
                </button>
              </div>

              {/* Quick Step Advance Button */}
              {activeTab === 'analyze' && (
                <button
                  onClick={() => setActiveTab('measure')}
                  className="hidden md:inline-flex items-center gap-1.5 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl border border-blue-200 transition-colors cursor-pointer"
                >
                  <span>Proceed to Measure</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* TAB CONTENT VIEWS */}
            {activeTab === 'analyze' && (
              <DepthAnalysisView
                originalImageSrc={imageSrc}
                depthData={depthData}
                analysisResult={analysisResult}
                activeColorMap={activeColorMap}
                onChangeColorMap={setActiveColorMap}
                lensPosition={lensPosition}
                onChangeLensPosition={setLensPosition}
                lensEnabled={lensEnabled}
                onToggleLens={setLensEnabled}
              />
            )}

            {activeTab === 'measure' && (
              <MeasurementTool
                imageSrc={imageSrc}
                originalWidth={imageWidth}
                originalHeight={imageHeight}
                depthData={depthData}
                calibration={calibration}
                setCalibration={setCalibration}
                measurement={measurement}
                setMeasurement={setMeasurement}
                bendMeasurement={bendMeasurement}
                setBendMeasurement={setBendMeasurement}
                areaMeasurement={areaMeasurement}
                setAreaMeasurement={setAreaMeasurement}
                activeMode={measurementMode}
                onChangeMode={setMeasurementMode}
              />
            )}

            {activeTab === '3d' && (
              <ThreeDDepthViewer
                originalImageSrc={imageSrc}
                depthData={depthData}
                onEnterFlyMode={() => setActiveTab('fly')}
              />
            )}

            {activeTab === 'fly' && (
              <FlyModeViewer
                originalImageSrc={imageSrc}
                depthData={depthData}
                depthStrength={1.4}
                onExit={() => setActiveTab('3d')}
              />
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 font-medium">
            <span>🪄 Depth Wizard</span>
            <span>•</span>
            <span>AI Monocular Depth Estimation & Calibrated Spatial Measurement</span>
          </p>
          <p className="text-slate-400">
            Engineered for high-accuracy interactive 3D scene reconstruction
          </p>
        </div>
      </footer>

      {/* Export & Download Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        originalImageSrc={imageSrc || ''}
        depthData={depthData}
        calibration={calibration}
        measurement={measurement}
        bendMeasurement={bendMeasurement}
        areaMeasurement={areaMeasurement}
        activeMeasurementMode={measurementMode}
      />

      {/* Help & Principles Modal */}
      <HelpGuideModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </div>
  );
}
