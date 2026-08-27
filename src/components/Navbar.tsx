import React from 'react';
import { Sparkles, RotateCcw, Download, HelpCircle, Layers, Ruler, Eye, Compass } from 'lucide-react';

interface NavbarProps {
  hasImage: boolean;
  hasDepth: boolean;
  activeTab: 'analyze' | 'measure' | '3d' | 'fly';
  setActiveTab: (tab: 'analyze' | 'measure' | '3d' | 'fly') => void;
  onReset: () => void;
  onOpenExport: () => void;
  onOpenHelp: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  hasImage,
  hasDepth,
  activeTab,
  setActiveTab,
  onReset,
  onOpenExport,
  onOpenHelp,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-blue-100 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-slate-900">DEPTH WIZARD</span>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
                AI Monocular 3D
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">AI Depth Estimation & Calibrated 3D Measurement</p>
          </div>
        </div>

        {/* Navigation Tabs (visible once image is loaded) */}
        {hasDepth && (
          <nav className="hidden md:flex items-center bg-slate-100/80 p-1 rounded-xl border border-slate-200 text-sm">
            <button
              id="nav-tab-depth"
              onClick={() => setActiveTab('analyze')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'analyze'
                  ? 'bg-white text-blue-600 shadow-xs border border-blue-100'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>AI Depth & Lens</span>
            </button>

            <button
              id="nav-tab-measure"
              onClick={() => setActiveTab('measure')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'measure'
                  ? 'bg-white text-blue-600 shadow-xs border border-blue-100'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Ruler className="w-4 h-4" />
              <span>Click & Measure</span>
            </button>

            <button
              id="nav-tab-3d"
              onClick={() => setActiveTab('3d')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === '3d'
                  ? 'bg-white text-blue-600 shadow-xs border border-blue-100'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Eye className="w-4 h-4" />
              <span>3D Depth View</span>
            </button>

            <button
              id="nav-tab-fly"
              onClick={() => setActiveTab('fly')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'fly'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>✈️ Fly Mode</span>
            </button>
          </nav>
        )}

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {hasDepth && (
            <button
              id="btn-export-assets"
              onClick={onOpenExport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
              title="Download results and assets"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}

          <button
            id="btn-help-modal"
            onClick={onOpenHelp}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="Application Guide & Principles"
          >
            <HelpCircle className="w-5 h-5" />
          </button>

          {hasImage && (
            <button
              id="btn-reset-project"
              onClick={onReset}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
              title="Reset project and clear all data"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
