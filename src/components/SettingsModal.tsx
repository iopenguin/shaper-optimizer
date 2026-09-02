import React, { useState } from 'react';
import { X, Sliders, ShieldCheck } from 'lucide-react';
import { CAMSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: CAMSettings;
  onSaveSettings: (settings: CAMSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  const [localSettings, setLocalSettings] = useState<CAMSettings>(settings);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveSettings(localSettings);
    onClose();
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
            <Sliders className="w-5 h-5 text-blue-400 shrink-0" />
            <h2 className="text-sm font-semibold text-slate-100">CAM & Volumetric Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition"
          >
            <X className="w-5 h-5 shrink-0" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-xs">
          {/* Volumetric Safe Overtravel Multiplier */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-200 inline-flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Volumetric Safe Overtravel</span>
              </label>
              <span className="chip bg-slate-900 text-cyan-400 border border-slate-800 font-mono font-semibold text-xs">
                {(localSettings.safeOvertravelMargin * 100).toFixed(0)}% Bit Radius
              </span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Allows the cutter to safely sweep past the nominal boundary of slots and dados into open air or deeper pockets to create clean, square corners without rounded fillets.
            </p>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.05"
              value={localSettings.safeOvertravelMargin}
              onChange={(e) =>
                setLocalSettings({
                  ...localSettings,
                  safeOvertravelMargin: parseFloat(e.target.value),
                })
              }
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
          </div>

          {/* 2-Column Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-medium mb-1.5">
                Slot Detection Tolerance (±%)
              </label>
              <input
                type="number"
                min="0.01"
                max="0.5"
                step="0.01"
                value={localSettings.slotDetectionTolerance}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    slotDetectionTolerance: parseFloat(e.target.value) || 0.15,
                  })
                }
                className="w-full h-10 bg-slate-950 border border-slate-800 rounded-lg px-3 text-slate-200 font-mono outline-none focus:border-blue-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Threshold for identifying exact-width centerline slots.
              </p>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1.5">
                Default Pocket Stepover Ratio
              </label>
              <input
                type="number"
                min="0.2"
                max="0.9"
                step="0.05"
                value={localSettings.stepOverRatio}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    stepOverRatio: parseFloat(e.target.value) || 0.65,
                  })
                }
                className="w-full h-10 bg-slate-950 border border-slate-800 rounded-lg px-3 text-slate-200 font-mono outline-none focus:border-blue-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Lateral step distance between concentric pocket loops.
              </p>
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3 pt-1">
            <label className="flex items-center justify-between p-3.5 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer hover:border-slate-700 transition">
              <div>
                <span className="font-medium text-slate-200 block">Climb Milling Direction</span>
                <span className="text-[11px] text-slate-400">
                  Cut counter-clockwise in interior pockets for optimal wood finish.
                </span>
              </div>
              <input
                type="checkbox"
                checked={localSettings.climbMilling}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, climbMilling: e.target.checked })
                }
                className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0 cursor-pointer ml-3 shrink-0"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer hover:border-slate-700 transition">
              <div>
                <span className="font-medium text-slate-200 block">Automatic Rest Machining</span>
                <span className="text-[11px] text-slate-400">
                  Clean tight internal corners with smaller detail bit after roughing.
                </span>
              </div>
              <input
                type="checkbox"
                checked={localSettings.enableRestMachining}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, enableRestMachining: e.target.checked })
                }
                className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0 cursor-pointer ml-3 shrink-0"
              />
            </label>
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
            onClick={handleSave}
            className="btn-material bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-sm"
          >
            Save & Recompute
          </button>
        </div>
      </div>
    </div>
  );
};
