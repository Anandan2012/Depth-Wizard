import React, { useRef } from 'react';
import { Upload, RotateCcw, RotateCw, RefreshCcw, Sparkles, Image as ImageIcon, CheckCircle2 } from 'lucide-react';

interface ImageUploaderProps {
  imageSrc: string | null;
  imageWidth: number;
  imageHeight: number;
  rotation: number;
  isProcessing: boolean;
  onImageSelected: (file: File) => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onResetRotation: () => void;
  onGenerateDepth: () => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  imageSrc,
  imageWidth,
  imageHeight,
  rotation,
  isProcessing,
  onImageSelected,
  onRotateLeft,
  onRotateRight,
  onResetRotation,
  onGenerateDepth,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImageSelected(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      onImageSelected(file);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-blue-100 shadow-xs p-6 max-w-4xl mx-auto">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
        id="file-upload-input"
      />

      {!imageSrc ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-blue-200 hover:border-blue-500 rounded-xl p-8 sm:p-12 text-center bg-blue-50/30 hover:bg-blue-50/60 transition-all cursor-pointer group"
        >
          <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
            <Upload className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">
            Upload an image to generate depth map
          </h3>
          <p className="text-sm text-slate-600 mb-4 max-w-md mx-auto">
            Drag and drop your photo here, or click to browse. Supports JPG, JPEG, PNG, and WEBP formats.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl shadow-xs group-hover:bg-blue-700 transition-colors">
            <ImageIcon className="w-4 h-4" />
            <span>Select Image</span>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-blue-600" />
                Original Image Loaded
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Dimensions: <span className="font-semibold text-slate-700">{imageWidth} × {imageHeight} px</span>
                {rotation !== 0 && (
                  <span className="ml-2 text-blue-600">({rotation}° rotated)</span>
                )}
              </p>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-slate-600 hover:text-blue-600 font-medium underline self-start sm:self-auto cursor-pointer"
            >
              Choose different image
            </button>
          </div>

          {/* Image Display with Rotation */}
          <div className="relative rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center min-h-[320px] max-h-[500px] border border-slate-200">
            <img
              src={imageSrc}
              alt="Uploaded Original"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: 'transform 0.3s ease',
              }}
              className="max-h-[480px] w-auto object-contain select-none"
            />
          </div>

          {/* Buttons: Rotate Left, Rotate Right, Reset Rotation, Generate Depth */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <button
                id="btn-rotate-left"
                onClick={onRotateLeft}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                title="Rotate 90 degrees counter-clockwise"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Rotate Left</span>
              </button>

              <button
                id="btn-rotate-right"
                onClick={onRotateRight}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                title="Rotate 90 degrees clockwise"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Rotate Right</span>
              </button>

              {rotation !== 0 && (
                <button
                  id="btn-reset-rotation"
                  onClick={onResetRotation}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  title="Reset rotation to 0"
                >
                  <RefreshCcw className="w-3.5 h-3.5" />
                  <span>Reset Rotation</span>
                </button>
              )}
            </div>

            <button
              id="btn-generate-depth"
              onClick={onGenerateDepth}
              disabled={isProcessing}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold text-sm rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
            >
              <Sparkles className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
              <span>{isProcessing ? 'Estimating Depth...' : 'Generate Depth'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
