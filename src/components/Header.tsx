import React, { useRef } from 'react';
import {
  Wrench,
  Sliders,
  Download,
  Upload,
  Box,
  Layers,
  Sparkles,
  FolderOpen,
} from 'lucide-react';
import { CAMProject, UnitType } from '../types';
import { SAMPLE_PROJECTS } from '../data/sampleSVGs';

interface HeaderProps {
  project: CAMProject;
  viewMode: '2d' | '3d';
  onViewModeChange: (mode: '2d' | '3d') => void;
  onOpenToolLibrary: () => void;
  onOpenSettings: () => void;
  onOpenExport: () => void;
  onLoadSample: (sampleId: string) => void;
  onFileUpload: (file: File) => void;
  onUnitChange: (unit: UnitType) => void;
}

export const Header: React.FC<HeaderProps> = ({
  project,
  viewMode,
  onViewModeChange,
  onOpenToolLibrary,
  onOpenSettings,
  onOpenExport,
  onLoadSample,
  onFileUpload,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  const enabledToolCount = project.tools.filter((t) => t.enabled !== false).length;

  return (
    <header className="fixed top-3.5 left-3.5 right-3.5 h-13 bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl px-4 flex items-center justify-between select-none z-30 shadow-2xl">
      {/* Brand & Project Info */}
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 rounded-xl shadow-sm text-white font-semibold text-xs tracking-tight shrink-0">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">Shaper Optimizer</span>
        </div>

        <div className="h-4 w-px bg-slate-800 hidden md:block" />

        <div className="flex items-center gap-2">
          <span
            className="text-xs text-slate-200 font-medium truncate max-w-[140px] md:max-w-[220px]"
            title={project.fileName}
          >
            {project.fileName || 'Untitled Project'}
          </span>
          <span className="chip bg-slate-950 text-slate-400 border border-slate-800 font-mono text-[11px]">
            {project.width.toFixed(1)} × {project.height.toFixed(1)} {project.units}
          </span>
        </div>
      </div>

      {/* Middle Controls: Samples & View Mode Switcher */}
      <div className="flex items-center gap-2">
        {/* Sample Designs Dropdown */}
        <div className="inline-flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 shadow-inner">
          <FolderOpen className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <select
            className="bg-transparent text-slate-200 border-none outline-none cursor-pointer text-xs max-w-[150px] md:max-w-none truncate"
            onChange={(e) => e.target.value && onLoadSample(e.target.value)}
            defaultValue=""
          >
            <option value="" disabled>
              Load Sample...
            </option>
            {SAMPLE_PROJECTS.map((sample) => (
              <option key={sample.id} value={sample.id} className="bg-slate-900 text-slate-200">
                {sample.name}
              </option>
            ))}
          </select>
        </div>

        {/* Upload Custom SVG */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".svg,image/svg+xml"
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="btn-material bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
          title="Upload Fusion 360 Shaper SVG export"
        >
          <Upload className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="hidden sm:inline">Upload SVG</span>
        </button>

        {/* 2D / 3D Mode Switcher */}
        <div className="inline-flex bg-slate-950 p-0.5 rounded-xl border border-slate-800 shadow-inner">
          <button
            onClick={() => onViewModeChange('2d')}
            className={`btn-material py-1 px-2.5 rounded-lg ${
              viewMode === '2d'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span>2D</span>
          </button>
          <button
            onClick={() => onViewModeChange('3d')}
            className={`btn-material py-1 px-2.5 rounded-lg ${
              viewMode === '3d'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Box className="w-3.5 h-3.5 shrink-0" />
            <span>3D</span>
          </button>
        </div>
      </div>

      {/* Right Controls: Bit Library, Settings, Export */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenToolLibrary}
          className="btn-material bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
          title="Configure Router Bits"
        >
          <Wrench className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="hidden md:inline">Bits ({enabledToolCount})</span>
        </button>

        <button
          onClick={onOpenSettings}
          className="btn-material p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
          title="CAM & Overtravel Settings"
        >
          <Sliders className="w-3.5 h-3.5 shrink-0" />
        </button>

        <button
          onClick={onOpenExport}
          className="btn-material bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold shadow-sm"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Export SVGs</span>
        </button>
      </div>
    </header>
  );
};
