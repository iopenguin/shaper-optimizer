import React, { useState } from 'react';
import { X, Plus, Trash2, Wrench, RotateCcw } from 'lucide-react';
import { ToolDefinition, UnitType } from '../types';
import { getDefaultTools } from '../data/defaultTools';

interface ToolLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  tools: ToolDefinition[];
  units: UnitType;
  onSaveTools: (tools: ToolDefinition[]) => void;
}

export const ToolLibraryModal: React.FC<ToolLibraryModalProps> = ({
  isOpen,
  onClose,
  tools,
  units,
  onSaveTools,
}) => {
  const [localTools, setLocalTools] = useState<ToolDefinition[]>(tools);
  const [activeToolId, setActiveToolId] = useState<string>(tools[0]?.id || '');

  if (!isOpen) return null;

  const activeTool = localTools.find((t) => t.id === activeToolId) || localTools[0];

  const handleUpdateActiveTool = (fields: Partial<ToolDefinition>) => {
    if (!activeTool) return;
    const updated = localTools.map((t) =>
      t.id === activeTool.id ? { ...t, ...fields } : t
    );
    setLocalTools(updated);
  };

  const handleAddTool = () => {
    const isInch = units === 'inch';
    const newTool: ToolDefinition = {
      id: `tool_${Date.now()}`,
      name: isInch ? '1/4" New Endmill' : '6mm New Endmill',
      diameter: isInch ? 0.25 : 6.0,
      fluteLength: isInch ? 0.75 : 20.0,
      maxStepDown: isInch ? 0.125 : 3.0,
      stepOverRatio: 0.65,
      feedRate: isInch ? 45 : 1200,
      plungeRate: isInch ? 15 : 400,
      color: '#06b6d4',
      enabled: true,
    };
    setLocalTools([...localTools, newTool]);
    setActiveToolId(newTool.id);
  };

  const handleDeleteTool = (id: string) => {
    if (localTools.length <= 1) return;
    const remaining = localTools.filter((t) => t.id !== id);
    setLocalTools(remaining);
    setActiveToolId(remaining[0].id);
  };

  const handleResetDefaults = () => {
    const defaults = getDefaultTools(units);
    setLocalTools(defaults);
    setActiveToolId(defaults[0].id);
  };

  const handleSave = () => {
    onSaveTools(localTools);
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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh] modal-animate">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900">
          <div className="inline-flex items-center gap-2.5">
            <Wrench className="w-5 h-5 text-amber-400 shrink-0" />
            <h2 className="text-sm font-semibold text-slate-100">Router Bit Library</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition"
          >
            <X className="w-5 h-5 shrink-0" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Left: Tool List */}
          <div className="w-72 border-r border-slate-800 flex flex-col bg-slate-950/60 shrink-0">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between shrink-0">
              <span className="text-xs font-medium text-slate-400">Available Bits</span>
              <button
                onClick={handleAddTool}
                className="btn-material py-1 px-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>Add Bit</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0">
              {localTools.map((tool) => {
                const isSelected = tool.id === activeTool?.id;
                return (
                  <div
                    key={tool.id}
                    onClick={() => setActiveToolId(tool.id)}
                    className={`p-3 rounded-xl flex items-center justify-between cursor-pointer transition text-xs ${
                      isSelected
                        ? 'bg-blue-600/20 border border-blue-500/50 text-blue-200'
                        : 'hover:bg-slate-800/40 text-slate-300 border border-transparent'
                    }`}
                  >
                    <div className="inline-flex items-center gap-2.5 truncate">
                      <span
                        className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: tool.color }}
                      />
                      <div className="flex flex-col truncate">
                        <span className="font-medium truncate text-slate-200">{tool.name}</span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          Ø {tool.diameter} {units}
                        </span>
                      </div>
                    </div>

                    <input
                      type="checkbox"
                      checked={tool.enabled !== false}
                      onChange={(e) => {
                        e.stopPropagation();
                        setLocalTools(
                          localTools.map((t) =>
                            t.id === tool.id ? { ...t, enabled: e.target.checked } : t
                          )
                        );
                      }}
                      className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0 cursor-pointer shrink-0 ml-2"
                      title="Enable tool in CAM optimization"
                    />
                  </div>
                );
              })}
            </div>

            <div className="p-3 border-t border-slate-800 shrink-0">
              <button
                onClick={handleResetDefaults}
                className="btn-material w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                <span>Reset Standard Bits</span>
              </button>
            </div>
          </div>

          {/* Right: Parameters Form */}
          <div className="flex-1 p-6 overflow-y-auto bg-slate-900 min-h-0">
            {activeTool ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">{activeTool.name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Configure cutting dimensions and feeds.</p>
                  </div>
                  {localTools.length > 1 && (
                    <button
                      onClick={() => handleDeleteTool(activeTool.id)}
                      className="btn-material p-2 text-red-400 hover:bg-red-950/50 rounded-lg border border-red-900/50"
                      title="Delete Tool"
                    >
                      <Trash2 className="w-4 h-4 shrink-0" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  {/* Bit Name */}
                  <div className="col-span-2">
                    <label className="block text-slate-400 font-medium mb-1.5">Bit Name</label>
                    <input
                      type="text"
                      value={activeTool.name}
                      onChange={(e) => handleUpdateActiveTool({ name: e.target.value })}
                      className="w-full h-10 bg-slate-950 border border-slate-800 rounded-lg px-3 text-slate-200 focus:border-blue-500 outline-none"
                    />
                  </div>

                  {/* Diameter */}
                  <div>
                    <label className="block text-slate-400 font-medium mb-1.5">
                      Cutter Diameter ({units})
                    </label>
                    <input
                      type="number"
                      step={units === 'inch' ? '0.03125' : '0.1'}
                      value={activeTool.diameter}
                      onChange={(e) =>
                        handleUpdateActiveTool({ diameter: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full h-10 bg-slate-950 border border-slate-800 rounded-lg px-3 text-slate-200 font-mono outline-none"
                    />
                  </div>

                  {/* Display Color */}
                  <div>
                    <label className="block text-slate-400 font-medium mb-1.5">Display Color</label>
                    <div className="flex items-center gap-2 h-10">
                      <input
                        type="color"
                        value={activeTool.color}
                        onChange={(e) => handleUpdateActiveTool({ color: e.target.value })}
                        className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer p-0.5"
                      />
                      <input
                        type="text"
                        value={activeTool.color}
                        onChange={(e) => handleUpdateActiveTool({ color: e.target.value })}
                        className="flex-1 h-10 bg-slate-950 border border-slate-800 rounded-lg px-3 text-slate-200 font-mono outline-none"
                      />
                    </div>
                  </div>

                  {/* Max Stepdown */}
                  <div>
                    <label className="block text-slate-400 font-medium mb-1.5">
                      Max Stepdown Per Pass ({units})
                    </label>
                    <input
                      type="number"
                      step={units === 'inch' ? '0.03125' : '0.5'}
                      value={activeTool.maxStepDown}
                      onChange={(e) =>
                        handleUpdateActiveTool({ maxStepDown: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full h-10 bg-slate-950 border border-slate-800 rounded-lg px-3 text-slate-200 font-mono outline-none"
                    />
                  </div>

                  {/* Feed Rate */}
                  <div>
                    <label className="block text-slate-400 font-medium mb-1.5">
                      Feed Rate ({units}/min)
                    </label>
                    <input
                      type="number"
                      value={activeTool.feedRate}
                      onChange={(e) =>
                        handleUpdateActiveTool({ feedRate: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full h-10 bg-slate-950 border border-slate-800 rounded-lg px-3 text-slate-200 font-mono outline-none"
                    />
                  </div>

                  {/* Stepover */}
                  <div className="col-span-2 bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 font-medium">Pocket Stepover</span>
                      <span className="chip bg-slate-900 text-blue-400 border border-slate-800 font-mono text-xs">
                        {(activeTool.stepOverRatio * 100).toFixed(0)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max="0.85"
                      step="0.05"
                      value={activeTool.stepOverRatio}
                      onChange={(e) =>
                        handleUpdateActiveTool({ stepOverRatio: parseFloat(e.target.value) })
                      }
                      className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">Select a tool to configure.</div>
            )}
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
            Apply & Recalculate Toolpaths
          </button>
        </div>
      </div>
    </div>
  );
};
