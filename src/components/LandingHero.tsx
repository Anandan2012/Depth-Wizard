import React from 'react';
import { Brain, Ruler, Search, Globe, Plane, Target, ArrowRight, Sparkles, Image as ImageIcon } from 'lucide-react';
import { SAMPLE_IMAGES, SampleImage } from '../utils/sampleImages';

interface LandingHeroProps {
  onSelectSample: (sample: SampleImage) => void;
  onTriggerUpload: () => void;
}

export const LandingHero: React.FC<LandingHeroProps> = ({ onSelectSample, onTriggerUpload }) => {
  return (
    <div className="py-8 sm:py-12">
      {/* Hero Header */}
      <div className="text-center max-w-3xl mx-auto mb-10 px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-semibold uppercase tracking-wider mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          Next-Gen AI Monocular Depth Estimation
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
          🪄 Depth Wizard
        </h1>
        <p className="text-xl sm:text-2xl font-medium text-blue-600 mb-3">
          &ldquo;See the hidden depth in every image.&rdquo;
        </p>
        <p className="text-slate-600 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
          Generate AI depth maps, measure real-world distances, and explore images in interactive 3D.
        </p>
      </div>

      {/* 6 Core Feature Cards */}
      <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
        <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-xs hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
            <Brain className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-1.5">
            🧠 AI Depth
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            AI-powered depth estimation. Accurately predicts relative spatial distance from single 2D images.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-xs hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
            <Ruler className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-1.5">
            📏 Click & Measure
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Measure real-world distances in meters using two-point reference calibration and spatial mapping.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-xs hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-1.5">
            🔍 Depth Lens
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Explore depth interactively. Slice through relative depth planes with smooth real-time visual thresholding.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-xs hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
            <Globe className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-1.5">
            🌐 3D Depth
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Turn images into interactive depth scenes with 3D mesh displacement, orbit controls, and density adjustments.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-xs hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
            <Plane className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-1.5">
            ✈️ Fly Mode
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Explore the reconstructed scene with first-person WASD / touch navigation and automated cinematic flyover.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-xs hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
            <Target className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-1.5">
            🎯 Confidence
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            View depth reliability metrics, scene geometry analysis, and depth layer distributions computed by AI.
          </p>
        </div>
      </div>

      {/* Quick Try Preset Samples */}
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <ImageIcon className="w-4 h-4 text-blue-600" />
            <span>Or try instantly with a curated sample image:</span>
          </div>
          <span className="text-xs text-slate-500">1-click demo</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {SAMPLE_IMAGES.map((sample) => (
            <button
              key={sample.id}
              onClick={() => onSelectSample(sample)}
              className="group relative overflow-hidden rounded-xl border border-slate-200 hover:border-blue-500 bg-white p-2 text-left transition-all hover:shadow-md cursor-pointer"
            >
              <div className="aspect-4/3 rounded-lg overflow-hidden mb-2 bg-slate-100 relative">
                <img
                  src={sample.url}
                  alt={sample.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  crossOrigin="anonymous"
                />
                <span className="absolute bottom-1 right-1 text-[10px] bg-slate-900/80 text-white px-1.5 py-0.5 rounded font-medium">
                  {sample.category}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-900 truncate group-hover:text-blue-600">
                {sample.name}
              </p>
              <div className="flex items-center gap-1 text-[11px] text-blue-600 mt-1 font-medium">
                <span>Load demo</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
