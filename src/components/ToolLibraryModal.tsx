import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Wrench,
  RotateCcw,
  Layers,
} from 'lucide-react';
import { ToolDefinition, CutterSection, CutterSectionType, UnitType } from '../types';
import { getDefaultTools } from '../data/defaultTools';
import { BitProfilePreview } from './BitProfilePreview';

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
  const [activeTab, setActiveTab] = useState<'profile' | 'speeds'>('profile');

  if (!isOpen) return null;

  const activeTool = localTools.find((t) => t.id === activeToolId) || localTools[0];
  const isInch = units === 'inch';

  const handleUpdateActiveTool = (fields: Partial<ToolDefinition>) => {
    if (!activeTool) return;
    const updated = localTools.map((t) =>
      t.id === activeTool.id ? { ...t, ...fields } : t
    );
    setLocalTools(updated);
  };

  const handleAddSection = () => {
    if (!activeTool) return;
    const currentSections = activeTool.sections || [];
    const newSec: CutterSection = {
      id: `sec_${Date.now()}`,
      type: 'straight',
      diameter: activeTool.diameter,
      height: isInch ? 0.25 : 6.0,
    };
    const updatedSections = [...currentSections, newSec];
    handleUpdateActiveTool({ sections: updatedSections });
  };

  const handleRemoveSection = (secId: string) => {
    if (!activeTool || (activeTool.sections?.length || 0) <= 1) return;
    const updatedSections = activeTool.sections.filter((s) => s.id !== secId);
    handleUpdateActiveTool({ sections: updatedSections });
  };

  const handleUpdateSection = (secId: string, fields: Partial<CutterSection>) => {
    if (!activeTool) return;
    const updatedSections = activeTool.sections.map((s) => {
      if (s.id === secId) {
        return { ...s, ...fields };
      }
      return s;
    });

    let maxDia = 0;
    let totalH = 0;
    for (const sec of updatedSections) {
      maxDia = Math.max(maxDia, sec.diameter || 0, sec.endDiameter || 0);
      totalH += sec.height || 0;
    }

    handleUpdateActiveTool({
      sections: updatedSections,
      diameter: maxDia > 0 ? maxDia : activeTool.diameter,
      fluteLength: totalH > 0 ? totalH : activeTool.fluteLength,
    });
  };

  const handleAddTool = () => {
    const newTool: ToolDefinition = {
      id: `tool_${Date.now()}`,
      name: isInch ? '1/4" Custom Cutter' : '6mm Custom Cutter',
      category: 'endmill',
      diameter: isInch ? 0.25 : 6.35,
      colletDiameter: isInch ? 0.25 : 6.35,
      fluteLength: isInch ? 0.75 : 19.05,
      maxStepDown: isInch ? 0.125 : 3.175,
      stepOverRatio: 0.65,
      feedRate: isInch ? 60 : 1500,
      plungeRate: isInch ? 20 : 500,
      color: '#38bdf8',
      enabled: true,
      sections: [
        {
          id: `sec_${Date.now()}`,
          type: 'straight',
          diameter: isInch ? 0.25 : 6.35,
          height: isInch ? 0.75 : 19.05,
        },
      ],
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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh] modal-animate">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/90">
          <div className="inline-flex items-center gap-2.5">
            <Wrench className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Shaper Router Bit Library</h2>
              <p className="text-[11px] text-slate-400">
                Configure cutter profiles, collets, stepdowns, and feeds.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition"
          >
            <X className="w-5 h-5 shrink-0" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Left Column: Bit Selector List with 2D Thumbnails */}
          <div className="w-80 border-r border-slate-800 flex flex-col bg-slate-950/70 shrink-0">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between shrink-0">
              <span className="text-xs font-medium text-slate-400">
                Official Catalog ({localTools.length})
              </span>
              <button
                onClick={handleAddTool}
                className="btn-material py-1 px-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>Custom Bit</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0">
              {localTools.map((tool) => {
                const isSelected = tool.id === activeTool?.id;
                return (
                  <div
                    key={tool.id}
                    onClick={() => setActiveToolId(tool.id)}
                    className={`p-2.5 rounded-xl flex items-center justify-between cursor-pointer transition text-xs ${
                      isSelected
                        ? 'bg-blue-600/20 border border-blue-500/50 text-blue-200 shadow-sm'
                        : 'hover:bg-slate-800/40 text-slate-300 border border-transparent'
                    }`}
                  >
                    {/* 2D Vector Silhouette Thumbnail */}
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="w-10 h-12 bg-slate-900 border border-slate-800/80 rounded-lg flex items-center justify-center shrink-0 p-0.5 shadow-inner">
                        <BitProfilePreview
                          tool={tool}
                          units={units}
                          width={36}
                          height={44}
                          showDimensions={false}
                        />
                      </div>

                      <div className="flex flex-col truncate">
                        <span className="font-medium truncate text-slate-200">{tool.name}</span>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                          <span>Ø {tool.diameter} {units}</span>
                          <span>•</span>
                          <span>{tool.category || 'endmill'}</span>
                        </div>
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

            <div className="p-3 border-t border-slate-800 shrink-0 bg-slate-950">
              <button
                onClick={handleResetDefaults}
                className="btn-material w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                <span>Reset Shaper Catalog</span>
              </button>
            </div>
          </div>

          {/* Right Column: Bit Geometry, 2D Profile Card & Multi-Section Editor */}
          <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden min-h-0">
            {activeTool ? (
              <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                {/* Top Bit Header & Tabs */}
                <div className="px-6 py-3.5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/90">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: activeTool.color }}
                    />
                    <div>
                      <h3 className="text-sm font-semibold text-slate-100">{activeTool.name}</h3>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {activeTool.sku || 'CUSTOM'} • Collet: Ø{activeTool.colletDiameter || activeTool.diameter} {units}
                      </span>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex items-center gap-2">
                    <div className="inline-flex bg-slate-950 p-0.5 rounded-xl border border-slate-800">
                      <button
                        onClick={() => setActiveTab('profile')}
                        className={`btn-material py-1 px-3 rounded-lg ${
                          activeTab === 'profile'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span>Cutter Profile</span>
                      </button>
                      <button
                        onClick={() => setActiveTab('speeds')}
                        className={`btn-material py-1 px-3 rounded-lg ${
                          activeTab === 'speeds'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span>Feeds & Speeds</span>
                      </button>
                    </div>

                    {localTools.length > 1 && (
                      <button
                        onClick={() => handleDeleteTool(activeTool.id)}
                        className="btn-material p-2 text-red-400 hover:bg-red-950/50 rounded-lg border border-red-900/50"
                        title="Delete Bit"
                      >
                        <Trash2 className="w-4 h-4 shrink-0" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Main Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6 min-h-0">
                  {activeTab === 'profile' ? (
                    <div className="grid grid-cols-12 gap-6">
                      {/* Left: Interactive 2D Profile Cross-Section */}
                      <div className="col-span-12 lg:col-span-5 bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-between shadow-inner">
                        <div className="w-full flex items-center justify-between pb-2 border-b border-slate-800 text-[11px] text-slate-400">
                          <span className="font-semibold text-slate-300">2D Profile Cross-Section</span>
                          <span className="font-mono">Ø {activeTool.diameter} {units}</span>
                        </div>

                        <div className="my-2 flex-1 flex items-center justify-center">
                          <BitProfilePreview
                            tool={activeTool}
                            units={units}
                            width={220}
                            height={260}
                            showDimensions={true}
                          />
                        </div>

                        <p className="text-[10px] text-slate-500 text-center italic">
                          Real-time vector cross-section rendered from stacked cutter sections.
                        </p>
                      </div>

                      {/* Right: Section Stack Manager & Collet Configuration */}
                      <div className="col-span-12 lg:col-span-7 space-y-4">
                        {/* Name & Collet Header */}
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <label className="block text-slate-400 font-medium mb-1">Bit Name</label>
                            <input
                              type="text"
                              value={activeTool.name}
                              onChange={(e) => handleUpdateActiveTool({ name: e.target.value })}
                              className="w-full h-9 bg-slate-950 border border-slate-800 rounded-lg px-3 text-slate-200 focus:border-blue-500 outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-400 font-medium mb-1">
                              Collet / Shank Diameter ({units})
                            </label>
                            <input
                              type="number"
                              step={isInch ? '0.03125' : '0.1'}
                              value={activeTool.colletDiameter || activeTool.diameter}
                              onChange={(e) =>
                                handleUpdateActiveTool({
                                  colletDiameter: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="w-full h-9 bg-slate-950 border border-slate-800 rounded-lg px-3 text-slate-200 font-mono focus:border-blue-500 outline-none"
                            />
                          </div>
                        </div>

                        {/* Sections Header */}
                        <div className="flex items-center justify-between pt-2">
                          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                            <Layers className="w-4 h-4 text-blue-400 shrink-0" />
                            <span>Cutter Sections (Top to Tip)</span>
                          </div>
                          <button
                            onClick={handleAddSection}
                            className="btn-material py-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs"
                          >
                            <Plus className="w-3.5 h-3.5 shrink-0" />
                            <span>Add Section</span>
                          </button>
                        </div>

                        {/* Sections Stack List */}
                        <div className="space-y-3">
                          {(activeTool.sections || []).map((sec, idx) => (
                            <div
                              key={sec.id || idx}
                              className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs space-y-3 shadow-sm"
                            >
                              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                                <span className="font-semibold text-slate-300">
                                  Section {idx + 1}: {sec.type.toUpperCase()}
                                </span>
                                {(activeTool.sections?.length || 0) > 1 && (
                                  <button
                                    onClick={() => handleRemoveSection(sec.id)}
                                    className="text-slate-500 hover:text-red-400 transition"
                                    title="Remove section"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>

                              {/* Section Properties Grid */}
                              <div className="grid grid-cols-3 gap-2.5">
                                <div>
                                  <label className="block text-[10px] text-slate-400 font-medium mb-1">
                                    Section Type
                                  </label>
                                  <select
                                    value={sec.type}
                                    onChange={(e) =>
                                      handleUpdateSection(sec.id, {
                                        type: e.target.value as CutterSectionType,
                                      })
                                    }
                                    className="w-full h-8 bg-slate-900 border border-slate-800 rounded-lg px-2 text-slate-200 outline-none text-xs"
                                  >
                                    <option value="straight">Straight</option>
                                    <option value="angled">Angled / Taper</option>
                                    <option value="outside-arc">Outside Arc (Fillet)</option>
                                    <option value="inside-arc">Inside Arc (Cove)</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-[10px] text-slate-400 font-medium mb-1">
                                    Diameter ({units})
                                  </label>
                                  <input
                                    type="number"
                                    step={isInch ? '0.03125' : '0.1'}
                                    value={sec.diameter}
                                    onChange={(e) =>
                                      handleUpdateSection(sec.id, {
                                        diameter: parseFloat(e.target.value) || 0,
                                      })
                                    }
                                    className="w-full h-8 bg-slate-900 border border-slate-800 rounded-lg px-2 text-slate-200 font-mono outline-none text-xs"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] text-slate-400 font-medium mb-1">
                                    Height / Length ({units})
                                  </label>
                                  <input
                                    type="number"
                                    step={isInch ? '0.03125' : '0.5'}
                                    value={sec.height}
                                    onChange={(e) =>
                                      handleUpdateSection(sec.id, {
                                        height: parseFloat(e.target.value) || 0,
                                      })
                                    }
                                    className="w-full h-8 bg-slate-900 border border-slate-800 rounded-lg px-2 text-slate-200 font-mono outline-none text-xs"
                                  />
                                </div>

                                {/* Conditional Fields for Angled */}
                                {sec.type === 'angled' && (
                                  <>
                                    <div>
                                      <label className="block text-[10px] text-slate-400 font-medium mb-1">
                                        End / Tip Dia ({units})
                                      </label>
                                      <input
                                        type="number"
                                        step={isInch ? '0.01' : '0.1'}
                                        value={sec.endDiameter ?? 0}
                                        onChange={(e) =>
                                          handleUpdateSection(sec.id, {
                                            endDiameter: parseFloat(e.target.value) || 0,
                                          })
                                        }
                                        className="w-full h-8 bg-slate-900 border border-slate-800 rounded-lg px-2 text-slate-200 font-mono outline-none text-xs"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-[10px] text-slate-400 font-medium mb-1">
                                        Taper Angle (°)
                                      </label>
                                      <input
                                        type="number"
                                        step="1"
                                        value={sec.taperAngle ?? 60}
                                        onChange={(e) =>
                                          handleUpdateSection(sec.id, {
                                            taperAngle: parseFloat(e.target.value) || 0,
                                          })
                                        }
                                        className="w-full h-8 bg-slate-900 border border-slate-800 rounded-lg px-2 text-slate-200 font-mono outline-none text-xs"
                                      />
                                    </div>
                                  </>
                                )}

                                {/* Conditional Fields for Arcs */}
                                {(sec.type === 'outside-arc' || sec.type === 'inside-arc') && (
                                  <div>
                                    <label className="block text-[10px] text-slate-400 font-medium mb-1">
                                      Arc Radius ({units})
                                    </label>
                                    <input
                                      type="number"
                                      step={isInch ? '0.03125' : '0.5'}
                                      value={sec.radius ?? sec.height}
                                      onChange={(e) =>
                                        handleUpdateSection(sec.id, {
                                          radius: parseFloat(e.target.value) || 0,
                                        })
                                      }
                                      className="w-full h-8 bg-slate-900 border border-slate-800 rounded-lg px-2 text-slate-200 font-mono outline-none text-xs"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Speeds & Feeds Tab */
                    <div className="space-y-4 text-xs max-w-xl">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-slate-400 font-medium mb-1.5">
                            Max Stepdown Per Pass ({units})
                          </label>
                          <input
                            type="number"
                            step={isInch ? '0.03125' : '0.5'}
                            value={activeTool.maxStepDown}
                            onChange={(e) =>
                              handleUpdateActiveTool({
                                maxStepDown: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full h-10 bg-slate-950 border border-slate-800 rounded-lg px-3 text-slate-200 font-mono outline-none focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 font-medium mb-1.5">
                            Display Color
                          </label>
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

                        <div>
                          <label className="block text-slate-400 font-medium mb-1.5">
                            Feed Rate ({units}/min)
                          </label>
                          <input
                            type="number"
                            value={activeTool.feedRate}
                            onChange={(e) =>
                              handleUpdateActiveTool({
                                feedRate: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full h-10 bg-slate-950 border border-slate-800 rounded-lg px-3 text-slate-200 font-mono outline-none focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 font-medium mb-1.5">
                            Plunge Rate ({units}/min)
                          </label>
                          <input
                            type="number"
                            value={activeTool.plungeRate}
                            onChange={(e) =>
                              handleUpdateActiveTool({
                                plungeRate: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full h-10 bg-slate-950 border border-slate-800 rounded-lg px-3 text-slate-200 font-mono outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-300 font-medium">Pocket Stepover Ratio</span>
                          <span className="chip bg-slate-900 text-blue-400 border border-slate-800 font-mono text-xs">
                            {((activeTool.stepOverRatio || 0.65) * 100).toFixed(0)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.2"
                          max="0.85"
                          step="0.05"
                          value={activeTool.stepOverRatio || 0.65}
                          onChange={(e) =>
                            handleUpdateActiveTool({
                              stepOverRatio: parseFloat(e.target.value),
                            })
                          }
                          className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-20 text-slate-500">Select a tool to view profile.</div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
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
