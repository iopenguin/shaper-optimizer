import React, { useState } from 'react';
import {
  X,
  Download,
  FileArchive,
  FileCode,
  Files,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { CAMProject, ExportFormat } from '../types';
import { exportToolpathSVGs } from '../exporter/svgExporter';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: CAMProject;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  project,
}) => {
  const [format, setFormat] = useState<ExportFormat>(project.exportSettings.format || 'both');
  const [prefix, setPrefix] = useState<string>(project.exportSettings.prefix || 'shaper');
  const [colorCodeByBit, setColorCodeByBit] = useState<boolean>(
    project.exportSettings.colorCodeByBit ?? true
  );
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportComplete, setExportComplete] = useState<boolean>(false);

  if (!isOpen) return null;

  const baseFileName = (project.fileName.replace(/\.svg$/i, '') || 'project') + '_' + prefix;

  const handleExecuteExport = async () => {
    setIsExporting(true);
    try {
      const updatedProject: CAMProject = {
        ...project,
        exportSettings: {
          ...project.exportSettings,
          format,
          prefix,
          colorCodeByBit,
        },
      };

      const result = await exportToolpathSVGs(updatedProject);

      if (format === 'single' && result.combinedSvg) {
        downloadBlob(
          new Blob([result.combinedSvg], { type: 'image/svg+xml;charset=utf-8' }),
          `${baseFileName}_combined.svg`
        );
      } else if (result.zipBlob) {
        downloadBlob(result.zipBlob, `${baseFileName}_shaper_toolpaths.zip`);
      }

      setExportComplete(true);
      setTimeout(() => {
        setExportComplete(false);
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to generate export files.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
      }}
      className="p-4"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl flex flex-col overflow-hidden modal-animate">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900">
          <div className="inline-flex items-center gap-2.5">
            <Download className="w-5 h-5 text-emerald-400 shrink-0" />
            <h2 className="text-sm font-semibold text-slate-100">Export Toolpath SVGs</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition"
          >
            <X className="w-5 h-5 shrink-0" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-xs">
          {/* Format Options */}
          <div>
            <label className="block text-slate-300 font-semibold mb-2.5">Export Mode</label>
            <div className="grid grid-cols-3 gap-3">
              {/* Option: Both (Recommended) */}
              <div
                onClick={() => setFormat('both')}
                className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col items-start gap-1.5 relative ${
                  format === 'both'
                    ? 'bg-emerald-950/40 border-emerald-500/80 text-emerald-200'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <FileArchive className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-semibold uppercase">
                    Default
                  </span>
                </div>
                <span className="font-semibold text-slate-200 mt-1">Both (.ZIP)</span>
                <span className="text-[10px] text-slate-400 leading-tight">
                  Single combined + individual per-bit SVGs + Cut Guide.
                </span>
              </div>

              {/* Option: Single Combined SVG */}
              <div
                onClick={() => setFormat('single')}
                className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col items-start gap-1.5 ${
                  format === 'single'
                    ? 'bg-blue-950/40 border-blue-500/80 text-blue-200'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <FileCode className="w-5 h-5 text-blue-400 shrink-0" />
                <span className="font-semibold text-slate-200 mt-1">Single SVG</span>
                <span className="text-[10px] text-slate-400 leading-tight">
                  All passes combined into one file with grouped layers.
                </span>
              </div>

              {/* Option: Multiple SVGs by Bit */}
              <div
                onClick={() => setFormat('multiple')}
                className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col items-start gap-1.5 ${
                  format === 'multiple'
                    ? 'bg-purple-950/40 border-purple-500/80 text-purple-200'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Files className="w-5 h-5 text-purple-400 shrink-0" />
                <span className="font-semibold text-slate-200 mt-1">Multi-File</span>
                <span className="text-[10px] text-slate-400 leading-tight">
                  Separate SVG file per router bit to eliminate errors.
                </span>
              </div>
            </div>
          </div>

          {/* Export Settings Details */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3.5">
            <div>
              <label className="block text-slate-400 font-medium mb-1.5">File Name Prefix</label>
              <input
                type="text"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                className="w-full h-10 bg-slate-900 border border-slate-800 rounded-lg px-3 text-slate-200 font-mono outline-none focus:border-blue-500"
              />
            </div>

            <label className="flex items-center justify-between cursor-pointer pt-1">
              <div>
                <span className="font-medium text-slate-300 block">Color-Code Toolpaths by Bit</span>
                <span className="text-[10px] text-slate-500">
                  Origin displays tool colors visually while cutting in On-Line mode.
                </span>
              </div>
              <input
                type="checkbox"
                checked={colorCodeByBit}
                onChange={(e) => setColorCodeByBit(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0 cursor-pointer ml-3 shrink-0"
              />
            </label>
          </div>

          {/* Export Info Box */}
          <div className="p-3.5 bg-blue-950/30 border border-blue-900/50 rounded-xl flex items-start gap-2.5 text-[11px] text-blue-300">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-medium text-blue-200 block">Generated Shaper Origin Paths</span>
              <p className="text-blue-300/80 mt-0.5 leading-relaxed">
                All toolpaths are formatted as exact <strong>On-Line</strong> cuts with{' '}
                <code className="text-blue-200 bg-blue-900/40 px-1 py-0.5 rounded font-mono">
                  shaper:cutDepth
                </code>{' '}
                metadata and 0.010" hairline strokes.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950 flex items-center justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="btn-material bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            Cancel
          </button>
          <button
            onClick={handleExecuteExport}
            disabled={isExporting || exportComplete}
            className="btn-material bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-semibold shadow-sm"
          >
            {exportComplete ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                <span>Exported Successfully!</span>
              </>
            ) : isExporting ? (
              <span>Packaging SVGs...</span>
            ) : (
              <>
                <Download className="w-4 h-4 shrink-0" />
                <span>
                  {format === 'both'
                    ? 'Download Complete Package (.ZIP)'
                    : format === 'single'
                    ? 'Download Combined SVG'
                    : 'Download Per-Bit Package (.ZIP)'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
