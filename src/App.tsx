import React, { useState, useEffect, useCallback } from 'react';
import { CAMProject, ToolDefinition, CAMSettings, UnitType } from './types';
import { parseSVG } from './parser/svgParser';
import { runCAMPipeline } from './cam/pipeline';
import { getDefaultTools } from './data/defaultTools';
import { SAMPLE_PROJECTS } from './data/sampleSVGs';
import { Header } from './components/Header';
import { Canvas2D } from './components/Canvas2D';
import { Visualizer3D } from './components/Visualizer3D';
import { OperationsPanel } from './components/OperationsPanel';
import { ToolLibraryModal } from './components/ToolLibraryModal';
import { SettingsModal } from './components/SettingsModal';
import { ExportModal } from './components/ExportModal';

const DEFAULT_SETTINGS: CAMSettings = {
  slotDetectionTolerance: 0.15,
  safeOvertravelMargin: 1.0, // 100% of bit radius overcut into open air / deeper pockets
  stepOverRatio: 0.65,
  climbMilling: true,
  enableRestMachining: true,
  cornerStrategy: 'square-overcut',
  leadInRadius: 0,
  simplifyTolerance: 0.05,
};

export const App: React.FC = () => {
  const [project, setProject] = useState<CAMProject>(() => {
    const initialSample = SAMPLE_PROJECTS[0];
    const initialTools = getDefaultTools(initialSample.units);
    const parsed = parseSVG(initialSample.svg, initialSample.name, initialSample.thickness);

    const baseProject: CAMProject = {
      fileName: initialSample.name,
      units: initialSample.units,
      width: parsed.width,
      height: parsed.height,
      totalThickness: initialSample.thickness,
      regions: parsed.regions,
      tools: initialTools,
      operations: [],
      settings: DEFAULT_SETTINGS,
      exportSettings: {
        format: 'both',
        includeGuideLayers: true,
        colorCodeByBit: true,
        strokeWidth: initialSample.units === 'inch' ? 0.01 : 0.254,
        includeShaperMetadata: true,
        units: initialSample.units,
        prefix: 'optimized',
      },
    };

    return runCAMPipeline(baseProject);
  });

  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [activeOpId, setActiveOpId] = useState<string | undefined>();
  const [isToolLibraryOpen, setIsToolLibraryOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);

  // Re-run pipeline whenever settings, tools, or regions change
  const recalculateProject = useCallback((base: CAMProject) => {
    const updated = runCAMPipeline(base);
    setProject(updated);
  }, []);

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        try {
          const parsed = parseSVG(content, file.name, project.totalThickness || 12);
          const tools = getDefaultTools(parsed.units);
          const newProject: CAMProject = {
            ...project,
            fileName: file.name,
            units: parsed.units,
            width: parsed.width,
            height: parsed.height,
            regions: parsed.regions,
            tools,
            operations: [],
          };
          recalculateProject(newProject);
        } catch (err) {
          console.error('Failed to parse SVG:', err);
          alert('Could not parse uploaded SVG file. Please check file format.');
        }
      }
    };
    reader.readAsText(file);
  };

  const handleLoadSample = (sampleId: string) => {
    const sample = SAMPLE_PROJECTS.find((s) => s.id === sampleId);
    if (!sample) return;

    const parsed = parseSVG(sample.svg, sample.name, sample.thickness);
    const tools = getDefaultTools(sample.units);

    const newProject: CAMProject = {
      ...project,
      fileName: sample.name,
      units: sample.units,
      width: parsed.width,
      height: parsed.height,
      totalThickness: sample.thickness,
      regions: parsed.regions,
      tools,
      operations: [],
    };
    recalculateProject(newProject);
  };

  const handleSaveTools = (tools: ToolDefinition[]) => {
    const updated: CAMProject = {
      ...project,
      tools,
    };
    recalculateProject(updated);
  };

  const handleSaveSettings = (settings: CAMSettings) => {
    const updated: CAMProject = {
      ...project,
      settings,
    };
    recalculateProject(updated);
  };

  const handleToggleOperationVisibility = (id: string) => {
    setProject((prev) => ({
      ...prev,
      operations: prev.operations.map((op) =>
        op.id === id ? { ...op, visible: !op.visible } : op
      ),
    }));
  };

  const handleToggleToolVisibility = (toolId: string) => {
    setProject((prev) => {
      const opsForTool = prev.operations.filter((op) => op.toolId === toolId);
      const allVisible = opsForTool.every((op) => op.visible);
      return {
        ...prev,
        operations: prev.operations.map((op) =>
          op.toolId === toolId ? { ...op, visible: !allVisible } : op
        ),
      };
    });
  };

  return (
    <div className="fixed inset-0 w-screen h-screen bg-slate-950 overflow-hidden text-slate-100 font-sans select-none">
      {/* 1. Full-Screen Visualizer Stage (100% of viewport) */}
      <main className="absolute inset-0 w-full h-full bg-slate-950 overflow-hidden">
        {viewMode === '2d' ? (
          <Canvas2D
            project={project}
            activeOperationId={activeOpId}
            onSelectOperation={setActiveOpId}
          />
        ) : (
          <Visualizer3D project={project} />
        )}
      </main>

      {/* 2. Floating Top Header Overlay */}
      <Header
        project={project}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onOpenToolLibrary={() => setIsToolLibraryOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onLoadSample={handleLoadSample}
        onFileUpload={handleFileUpload}
        onUnitChange={(units: UnitType) => {
          const tools = getDefaultTools(units);
          recalculateProject({ ...project, units, tools });
        }}
      />

      {/* 3. Floating Collapsible Operations Panel Overlay */}
      <OperationsPanel
        project={project}
        activeOperationId={activeOpId}
        onSelectOperation={setActiveOpId}
        onToggleOperationVisibility={handleToggleOperationVisibility}
        onToggleToolVisibility={handleToggleToolVisibility}
      />

      {/* 4. Modals */}
      <ToolLibraryModal
        isOpen={isToolLibraryOpen}
        onClose={() => setIsToolLibraryOpen(false)}
        tools={project.tools}
        units={project.units}
        onSaveTools={handleSaveTools}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={project.settings}
        onSaveSettings={handleSaveSettings}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        project={project}
      />
    </div>
  );
};

export default App;
