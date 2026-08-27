import React from 'react';
import { X, BookOpen, Ruler, Sparkles, AlertCircle, Spline, Hexagon } from 'lucide-react';

interface HelpGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpGuideModal: React.FC<HelpGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Depth Wizard User Guide</h3>
              <p className="text-xs text-slate-500">Principles of Monocular Depth & Calibrated Spatial Measurement</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
          {/* Step by Step Workflow */}
          <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-200 space-y-2">
            <h4 className="font-bold text-sm text-blue-950 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-blue-600" />
              Complete Measurement Workflow
            </h4>
            <ol className="list-decimal list-inside space-y-1 text-slate-700">
              <li><strong>Upload Image:</strong> Select or drop any photo. Rotate if needed.</li>
              <li><strong>AI Depth Generation:</strong> Model computes relative depth map and spatial strata.</li>
              <li><strong>Calibration (Step 1):</strong> Pick Points A & B on a known object (e.g. 1.00m table or door) to establish pixel-to-meter scale.</li>
              <li><strong>Target Measurement (Step 2):</strong> Select one of 3 measurement tools:
                <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                  <li><strong>Straight Distance:</strong> Click 2 points (C → D) to measure direct span.</li>
                  <li><strong>Bending & Curve:</strong> Click sequential points along bent pipes, cables, arcs, or roads to measure total curve length, straight chord, and maximum bend deflection.</li>
                  <li><strong>Irregular Area:</strong> Click vertices or draw freehand around any irregular region to calculate enclosed surface area ($m^2$, $ft^2$) and boundary perimeter.</li>
                </ul>
              </li>
              <li><strong>3D Depth View & Fly Mode:</strong> Explore depth contours and inspect scene depth.</li>
            </ol>
          </div>

          {/* Mathematical Logic */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
              <Ruler className="w-4 h-4 text-blue-600" />
              Geometric Mathematics
            </h4>
            <div className="font-mono text-[11px] bg-white p-3 rounded-xl border border-slate-200 space-y-1">
              <p>• Scale (m/px) = Known Real Distance (m) / Reference Pixel Distance</p>
              <p>• Straight Span = Pixel Distance × Scale</p>
              <p>• Bending Arc = Σ(Segment Distances) × Scale</p>
              <p>• Max Sagitta Deflection = Max Perpendicular Offset to Chord Line</p>
              <p className="text-emerald-700 font-bold">• Irregular Area (m²) = Shoelace Formula Area (px²) × (Scale)²</p>
            </div>
          </div>

          {/* Bending & Irregular Area Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200 space-y-1">
              <h5 className="font-bold text-xs text-indigo-950 flex items-center gap-1">
                <Spline className="w-3.5 h-3.5 text-indigo-600" />
                Bending & Curvature
              </h5>
              <p className="text-[11px] text-slate-600">
                Measures the true contour length along bent beams, pipes, or arches, plus straight chord distance and camber deflection.
              </p>
            </div>

            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-1">
              <h5 className="font-bold text-xs text-emerald-950 flex items-center gap-1">
                <Hexagon className="w-3.5 h-3.5 text-emerald-600" />
                Irregular Area Coverage
              </h5>
              <p className="text-[11px] text-slate-600">
                Trace complex multi-point polygons or freehand contours to measure surface areas in square meters ($m^2$) and square feet ($ft^2$).
              </p>
            </div>
          </div>

          {/* Accuracy & Monocular Depth Disclaimer */}
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-1.5 text-amber-950">
            <h4 className="font-bold text-sm flex items-center gap-1.5 text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              Important Monocular Depth Disclaimer
            </h4>
            <p>
              Monocular depth estimation models predict relative depth from 2D visual cues. Real-world measurements require user calibration with a known reference object.
            </p>
            <p className="text-[11px] text-amber-800">
              Accuracy is optimal when the reference object and target points lie on approximately parallel planes relative to the camera lens.
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          Got it
        </button>
      </div>
    </div>
  );
};
