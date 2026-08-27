import React from 'react';
import {
  DepthMapData,
  CalibrationData,
  MeasurementData,
  BendMeasurementData,
  AreaMeasurementData,
  MeasurementType,
} from '../types';
import { X, Download, FileImage, Layers, Ruler, Spline, Hexagon } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalImageSrc: string;
  depthData: DepthMapData | null;
  calibration: CalibrationData;
  measurement: MeasurementData;
  bendMeasurement?: BendMeasurementData;
  areaMeasurement?: AreaMeasurementData;
  activeMeasurementMode?: MeasurementType;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  originalImageSrc,
  depthData,
  calibration,
  measurement,
  bendMeasurement,
  areaMeasurement,
  activeMeasurementMode = 'straight',
}) => {
  if (!isOpen) return null;

  const downloadOriginal = () => {
    const link = document.createElement('a');
    link.download = 'depth-wizard-original.png';
    link.href = originalImageSrc;
    link.click();
  };

  const downloadDepthMap = () => {
    if (!depthData) return;
    const link = document.createElement('a');
    link.download = 'depth-wizard-depthmap.png';
    link.href = depthData.dataUrl;
    link.click();
  };

  const downloadMeasurementReport = () => {
    // Generate a high-resolution measurement report canvas
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 850;
    const ctx = canvas.getContext('2d')!;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1200, 850);

    // Header gradient
    const grad = ctx.createLinearGradient(0, 0, 1200, 0);
    grad.addColorStop(0, '#1e40af');
    grad.addColorStop(1, '#2563eb');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1200, 140);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText('🪄 DEPTH WIZARD — SPATIAL MEASUREMENT REPORT', 50, 70);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#dbeafe';
    ctx.fillText('Calibrated Monocular & 2D/3D Geometric Analysis', 50, 105);

    if (activeMeasurementMode === 'bending' && bendMeasurement && bendMeasurement.isComplete) {
      // BENDING REPORT
      ctx.fillStyle = '#eef2ff';
      ctx.strokeStyle = '#a5b4fc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(50, 170, 1100, 220, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#4338ca';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('BENDING & CURVED PATH MEASUREMENT', 80, 215);

      ctx.fillStyle = '#1e1b4b';
      ctx.font = 'bold 56px sans-serif';
      ctx.fillText(`${bendMeasurement.totalMeterLength} m (Arc Length)`, 80, 290);

      ctx.font = '22px sans-serif';
      ctx.fillStyle = '#4f46e5';
      ctx.fillText(
        `Straight Chord: ${bendMeasurement.chordMeterDistance} m  •  Max Deflection: ${(bendMeasurement.maxDeflectionMeters! * 100).toFixed(1)} cm`,
        80,
        345
      );

      // Grid of metrics
      const metricsY = 420;
      const metrics = [
        { label: 'Reference Distance', value: calibration.knownDistanceMeters ? `${calibration.knownDistanceMeters} m` : 'N/A' },
        { label: 'Curvature Ratio (Arc/Chord)', value: `${bendMeasurement.bendingRatio}×` },
        { label: 'Total Turning Bend Angle', value: `${bendMeasurement.totalAngleDeg}°` },
        { label: '3D True Path Length', value: `${bendMeasurement.true3DLengthMeters} m` },
      ];

      metrics.forEach((m, idx) => {
        const colX = 50 + (idx % 2) * 560;
        const rowY = metricsY + Math.floor(idx / 2) * 110;

        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.roundRect(colX, rowY, 530, 90, 12);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#64748b';
        ctx.font = '15px sans-serif';
        ctx.fillText(m.label, colX + 25, rowY + 38);

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 24px monospace';
        ctx.fillText(m.value, colX + 25, rowY + 72);
      });
    } else if (activeMeasurementMode === 'irregular_area' && areaMeasurement && areaMeasurement.isComplete) {
      // IRREGULAR AREA REPORT
      ctx.fillStyle = '#f0fdf4';
      ctx.strokeStyle = '#86efac';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(50, 170, 1100, 220, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#15803d';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('IRREGULAR SURFACE AREA COVERAGE', 80, 215);

      ctx.fillStyle = '#052e16';
      ctx.font = 'bold 56px sans-serif';
      ctx.fillText(`${areaMeasurement.meterArea} m² (${areaMeasurement.sqFeetArea} sq ft)`, 80, 290);

      ctx.font = '22px sans-serif';
      ctx.fillStyle = '#16a34a';
      ctx.fillText(
        `Perimeter: ${areaMeasurement.meterPerimeter} m  •  Boundary Points: ${areaMeasurement.points.length}`,
        80,
        345
      );

      // Grid of metrics
      const metricsY = 420;
      const metrics = [
        { label: 'Bounding Box Width', value: areaMeasurement.boundingRect ? `${areaMeasurement.boundingRect.widthMeters} m` : 'N/A' },
        { label: 'Bounding Box Height', value: areaMeasurement.boundingRect ? `${areaMeasurement.boundingRect.heightMeters} m` : 'N/A' },
        { label: 'Area in cm²', value: areaMeasurement.sqCmArea ? `${areaMeasurement.sqCmArea.toLocaleString()} cm²` : 'N/A' },
        { label: 'Average Depth Layer', value: areaMeasurement.avgDepth !== null ? `${Math.round(areaMeasurement.avgDepth * 100)}%` : 'N/A' },
      ];

      metrics.forEach((m, idx) => {
        const colX = 50 + (idx % 2) * 560;
        const rowY = metricsY + Math.floor(idx / 2) * 110;

        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.roundRect(colX, rowY, 530, 90, 12);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#64748b';
        ctx.font = '15px sans-serif';
        ctx.fillText(m.label, colX + 25, rowY + 38);

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 24px monospace';
        ctx.fillText(m.value, colX + 25, rowY + 72);
      });
    } else {
      // STRAIGHT LINE REPORT
      ctx.fillStyle = '#f0fdf4';
      ctx.strokeStyle = '#86efac';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(50, 170, 1100, 220, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#15803d';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('ESTIMATED REAL-WORLD DISTANCE', 80, 215);

      ctx.fillStyle = '#052e16';
      ctx.font = 'bold 64px sans-serif';
      const estDist = measurement.estimatedDistanceMeters ? `${measurement.estimatedDistanceMeters} m` : 'Not Measured';
      ctx.fillText(estDist, 80, 295);

      // Grid of metrics
      const metricsY = 420;
      const metrics = [
        { label: 'Reference Known Distance', value: calibration.knownDistanceMeters ? `${calibration.knownDistanceMeters} m` : 'N/A' },
        { label: 'Reference Pixel Distance', value: calibration.referencePixelDistance ? `${calibration.referencePixelDistance} px` : 'N/A' },
        { label: 'Target Measured Pixels', value: measurement.measuredPixelDistance ? `${measurement.measuredPixelDistance} px` : 'N/A' },
        { label: 'Calibration Scale Factor', value: calibration.metersPerPixel ? `${calibration.metersPerPixel.toFixed(6)} m/px` : 'N/A' },
      ];

      metrics.forEach((m, idx) => {
        const colX = 50 + (idx % 2) * 560;
        const rowY = metricsY + Math.floor(idx / 2) * 110;

        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.roundRect(colX, rowY, 530, 90, 12);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#64748b';
        ctx.font = '15px sans-serif';
        ctx.fillText(m.label, colX + 25, rowY + 38);

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 24px monospace';
        ctx.fillText(m.value, colX + 25, rowY + 72);
      });
    }

    // Disclaimer footer
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'italic 13px sans-serif';
    ctx.fillText(
      'Disclaimer: Spatial measurements and surface calculations are calibrated image-based estimates derived from relative geometry.',
      50,
      800
    );

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `depth-wizard-report-${activeMeasurementMode}.png`;
    link.href = dataUrl;
    link.click();
  };

  const hasAnyMeasurement =
    measurement.isComplete ||
    (bendMeasurement && bendMeasurement.isComplete) ||
    (areaMeasurement && areaMeasurement.isComplete);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Export Project Assets</h3>
              <p className="text-xs text-slate-500">Download high-resolution outputs and reports</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Download Options */}
        <div className="space-y-3">
          <button
            onClick={downloadOriginal}
            className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-2xl transition-all text-left cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <FileImage className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900 block">Original Image</span>
                <span className="text-xs text-slate-500">Source image file</span>
              </div>
            </div>
            <Download className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
          </button>

          {depthData && (
            <button
              onClick={downloadDepthMap}
              className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-2xl transition-all text-left cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-sm font-bold text-slate-900 block">Generated Depth Map</span>
                  <span className="text-xs text-slate-500">High-fidelity grayscale PNG map</span>
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
            </button>
          )}

          {hasAnyMeasurement && (
            <button
              onClick={downloadMeasurementReport}
              className="w-full flex items-center justify-between p-3.5 bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-200 hover:border-emerald-300 rounded-2xl transition-all text-left cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-emerald-200 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  {activeMeasurementMode === 'bending' ? (
                    <Spline className="w-5 h-5 text-indigo-600" />
                  ) : activeMeasurementMode === 'irregular_area' ? (
                    <Hexagon className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <Ruler className="w-5 h-5 text-emerald-600" />
                  )}
                </div>
                <div>
                  <span className="text-sm font-bold text-slate-900 block">
                    {activeMeasurementMode === 'bending'
                      ? 'Bending & Curve Report Card'
                      : activeMeasurementMode === 'irregular_area'
                      ? 'Irregular Area Report Card'
                      : 'Straight Measurement Report Card'}
                  </span>
                  <span className="text-xs text-slate-600">
                    {activeMeasurementMode === 'bending' && bendMeasurement?.totalMeterLength
                      ? `${bendMeasurement.totalMeterLength} m arc length + chord & deflection`
                      : activeMeasurementMode === 'irregular_area' && areaMeasurement?.meterArea
                      ? `${areaMeasurement.meterArea} m² area + perimeter & bounds`
                      : `Estimated ${measurement.estimatedDistanceMeters ?? 0} m + calibration data`}
                  </span>
                </div>
              </div>
              <Download className="w-4 h-4 text-emerald-600" />
            </button>
          )}
        </div>

        <div className="pt-2 text-center">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
