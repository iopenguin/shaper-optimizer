import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Layers,
  Clock,
  Activity,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { CAMProject, ToolpathOperation } from '../types';

interface OperationsPanelProps {
  project: CAMProject;
  activeOperationId?: string;
  onSelectOperation: (id: string) => void;
  onToggleOperationVisibility: (id: string) => void;
  onToggleToolVisibility: (toolId: string) => void;
}

export const OperationsPanel: React.FC<OperationsPanelProps> = ({
  project,
  activeOperationId,
  onSelectOperation,
  onToggleOperationVisibility,
  onToggleToolVisibility,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const { operations, units } = project;

  // Group operations by Tool ID
  const toolGroups = new Map<string, ToolpathOperation[]>();
  for (const op of operations) {
    const list = toolGroups.get(op.toolId) || [];
    list.push(op);
    toolGroups.set(op.toolId, list);
  }

  // Totals
  let totalLength = 0;
  let totalSeconds = 0;
  for (const op of operations) {
    if (op.visible) {
      totalLength += op.estimatedLength;
      totalSeconds += op.estimatedTimeSec;
    }
  }

  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.round(totalSeconds % 60);

  // If Collapsed, show compact floating trigger button
  if (isCollapsed) {
    return (
      <div className="fixed top-20 right-3.5 z-30 flex flex-col items-end">
        <button
          onClick={() => setIsCollapsed(false)}
          className="btn-material bg-slate-900/90 hover:bg-slate-800 backdrop-blur-xl border border-slate-800 text-slate-200 px-3 py-2 rounded-xl shadow-2xl transition"
          title="Expand Operations & Passes Panel"
        >
          <ChevronLeft className="w-4 h-4 text-blue-400 shrink-0" />
          <Layers className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="font-semibold text-xs">{operations.length} Passes</span>
        </button>
      </div>
    );
  }

  return (
    <aside
      onWheel={(e) => e.stopPropagation()}
      className="fixed top-20 right-3.5 bottom-3.5 w-84 sm:w-96 bg-slate-900/95 backdrop-blur-2xl border border-slate-800 rounded-2xl flex flex-col select-none z-30 shadow-2xl drawer-animate overflow-hidden"
    >
      {/* Header with Collapse Button */}
      <div className="p-3.5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/80">
        <div className="inline-flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-400 shrink-0" />
          <h2 className="text-sm font-semibold text-slate-100">Operations & Passes</h2>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="chip bg-slate-950 text-slate-300 border border-slate-800 font-mono text-[11px]">
            {operations.length} passes
          </span>
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition"
            title="Collapse Panel"
          >
            <ChevronRight className="w-4 h-4 shrink-0" />
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="p-3 bg-slate-950/60 border-b border-slate-800/80 grid grid-cols-2 gap-2 text-xs shrink-0">
        <div className="bg-slate-900/90 border border-slate-800/80 p-2.5 rounded-xl flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400">Machining Time</span>
            <span className="font-mono font-semibold text-slate-200 text-xs">
              {mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}
            </span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/80 p-2.5 rounded-xl flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400">Cut Distance</span>
            <span className="font-mono font-semibold text-slate-200 text-xs">
              {totalLength.toFixed(1)} {units}
            </span>
          </div>
        </div>
      </div>

      {/* Operations Scrollable Tree */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {Array.from(toolGroups.entries()).map(([toolId, ops], groupIdx) => {
          const tool = ops[0].tool;
          const isToolVisible = ops.some((o) => o.visible);

          return (
            <div
              key={toolId}
              className="bg-slate-950/90 border border-slate-800 rounded-xl overflow-hidden shadow-sm"
            >
              {/* Tool Group Header */}
              <div className="px-3 py-2 bg-slate-800/60 border-b border-slate-800 flex items-center justify-between">
                <div className="inline-flex items-center gap-2 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: tool.color }}
                  />
                  <span className="text-xs font-semibold text-slate-200 truncate">
                    Step {groupIdx + 1}: {tool.name}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0">
                    (Ø {tool.diameter} {units})
                  </span>
                </div>

                <button
                  onClick={() => onToggleToolVisibility(toolId)}
                  className="p-1 text-slate-400 hover:text-slate-200 transition shrink-0"
                  title="Toggle Tool Visibility"
                >
                  {isToolVisible ? (
                    <Eye className="w-3.5 h-3.5" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5 text-slate-600" />
                  )}
                </button>
              </div>

              {/* Passes List */}
              <div className="divide-y divide-slate-800/40">
                {ops.map((op) => {
                  const isSelected = op.id === activeOperationId;
                  return (
                    <div
                      key={op.id}
                      onClick={() => onSelectOperation(op.id)}
                      className={`px-3 py-2 flex items-center justify-between cursor-pointer transition text-xs ${
                        isSelected
                          ? 'bg-blue-600/20 border-l-2 border-blue-500'
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="inline-flex items-center gap-2 truncate">
                        <div
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: op.color }}
                        />
                        <div className="flex flex-col truncate">
                          <span
                            className={`font-medium truncate ${
                              isSelected ? 'text-blue-300' : 'text-slate-300'
                            }`}
                          >
                            {op.name}
                          </span>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                            <span>
                              Z: -{op.currentPassDepth.toFixed(2)} {units}
                            </span>
                            <span>•</span>
                            <span>
                              {op.estimatedLength.toFixed(1)} {units}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleOperationVisibility(op.id);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-200 transition shrink-0"
                      >
                        {op.visible ? (
                          <Eye className="w-3 h-3 text-slate-400" />
                        ) : (
                          <EyeOff className="w-3 h-3 text-slate-600" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {operations.length === 0 && (
          <div className="text-center py-10 px-4 text-slate-500">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-600" />
            <p className="text-xs">No active toolpaths generated.</p>
            <p className="text-[11px] text-slate-600 mt-1">
              Enable tools in Bit Library or upload an SVG with cut depths.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-start gap-2 text-[11px] text-slate-400 shrink-0">
        <HelpCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <p>
          On Origin: Select <strong>On-Line</strong> cut mode. The router will guide along exact
          centerlines.
        </p>
      </div>
    </aside>
  );
};
