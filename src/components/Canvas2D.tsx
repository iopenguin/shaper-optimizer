import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { CAMProject, Point } from '../types';
import { dist } from '../geometry/point';

interface Canvas2DProps {
  project: CAMProject;
  activeOperationId?: string;
  onSelectOperation?: (id: string) => void;
}

export const Canvas2D: React.FC<Canvas2DProps> = ({
  project,
  activeOperationId,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Dynamic scale bounds based on unit
  const isInch = project.units === 'inch';
  const minAllowedScale = isInch ? 0.5 : 0.05;
  const maxAllowedScale = isInch ? 50000.0 : 500.0;

  // Transform state (pan and zoom)
  const [scale, setScale] = useState<number>(() => (isInch ? 80.0 : 3.0));
  const [offset, setOffset] = useState<Point>({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState<Point | null>(null);

  // Simulation playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackProgress, setPlaybackProgress] = useState<number>(1.0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const animFrameRef = useRef<number | null>(null);

  // Display layer toggles
  const [showRegions, setShowRegions] = useState<boolean>(true);
  const [showToolpaths, setShowToolpaths] = useState<boolean>(true);
  const [showOvertravel, setShowOvertravel] = useState<boolean>(true);
  const [showCutterDisk, setShowCutterDisk] = useState<boolean>(true);

  // Track last project to fit to screen once per project load
  const lastProjectRef = useRef<string>('');

  const fitToScreen = useCallback(() => {
    const container = containerRef.current;
    if (!container || project.width <= 0 || project.height <= 0) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width <= 0 || height <= 0) return;

    const pad = 80;
    const scaleX = (width - pad * 2) / project.width;
    const scaleY = (height - pad * 2) / project.height;
    const calculatedScale = Math.min(scaleX, scaleY);
    const newScale = Math.max(minAllowedScale, Math.min(calculatedScale, maxAllowedScale));

    const newOffsetX = (width - project.width * newScale) / 2;
    const newOffsetY = (height - project.height * newScale) / 2;

    setScale(newScale);
    setOffset({ x: newOffsetX, y: newOffsetY });
  }, [project.width, project.height, minAllowedScale, maxAllowedScale]);

  // Initial fit on project load or dimensions change
  useEffect(() => {
    const projectKey = `${project.fileName}_${project.units}_${project.width}_${project.height}`;
    if (lastProjectRef.current !== projectKey) {
      lastProjectRef.current = projectKey;
      const timer = setTimeout(() => {
        fitToScreen();
      }, 50);
      setPlaybackProgress(1.0);
      setIsPlaying(false);
      return () => clearTimeout(timer);
    }
  }, [project.fileName, project.units, project.width, project.height, fitToScreen]);

  // Handle window resize without feedback loop
  useEffect(() => {
    let resizeTimer: any;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        fitToScreen();
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
    };
  }, [fitToScreen]);

  // Playback animation loop
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    let lastTime = performance.now();
    const animate = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      setPlaybackProgress((prev) => {
        const speedMultiplier = playbackSpeed * 0.08;
        const next = prev + dt * speedMultiplier;
        if (next >= 1.0) {
          setIsPlaying(false);
          return 1.0;
        }
        return next;
      });

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, playbackSpeed]);

  // Main Canvas Render
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width <= 0 || height <= 0) return;

    const targetW = Math.floor(width * dpr);
    const targetH = Math.floor(height * dpr);

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Apply viewport transform
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    // 1. Draw Grid
    drawGrid(ctx, project.width, project.height, project.units, scale);

    // 2. Draw Stock Outline
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.2 / scale;
    ctx.setLineDash([4 / scale, 4 / scale]);
    ctx.strokeRect(0, 0, project.width, project.height);
    ctx.setLineDash([]);

    // 3. Draw Depth Regions (Heatmap)
    if (showRegions) {
      for (const region of project.regions) {
        if (region.sourceType === 'exterior') continue;

        const depthRatio = Math.min(1.0, region.depth / (project.totalThickness || 12));
        const alpha = 0.18 + depthRatio * 0.5;
        ctx.fillStyle = `rgba(59, 130, 246, ${alpha})`;
        ctx.strokeStyle = `rgba(96, 165, 250, 0.9)`;
        ctx.lineWidth = 1 / scale;

        for (const polyWithHoles of region.polygons) {
          ctx.beginPath();
          const outer = polyWithHoles.outer;
          if (outer.length > 0) {
            ctx.moveTo(outer[0].x, outer[0].y);
            for (let i = 1; i < outer.length; i++) {
              ctx.lineTo(outer[i].x, outer[i].y);
            }
            ctx.closePath();
          }

          for (const hole of polyWithHoles.holes) {
            if (hole.length > 0) {
              ctx.moveTo(hole[0].x, hole[0].y);
              for (let i = 1; i < hole.length; i++) {
                ctx.lineTo(hole[i].x, hole[i].y);
              }
              ctx.closePath();
            }
          }
          ctx.fill();
          ctx.stroke();

          // Label depth - scale text cleanly to exactly 10 screen pixels regardless of unit
          if (outer.length > 0) {
            ctx.fillStyle = '#94a3b8';
            const fontSizeWorld = 10 / scale;
            ctx.font = `${fontSizeWorld}px system-ui, -apple-system, sans-serif`;
            ctx.fillText(
              `-${region.depth.toFixed(isInch ? 3 : 1)}${project.units}`,
              outer[0].x + 3 / scale,
              outer[0].y + 12 / scale
            );
          }
        }
      }
    }

    // 4. Draw Toolpaths & Safe Overtravels
    if (showToolpaths) {
      let totalCutDist = 0;
      project.operations.forEach((op) => {
        if (op.visible) totalCutDist += op.estimatedLength;
      });

      let accumulatedDist = 0;
      const targetAnimDist = totalCutDist * playbackProgress;
      let currentCutterPos: Point | null = null;
      let currentCutterRadius = 3;

      for (const op of project.operations) {
        if (!op.visible) continue;

        const isOpActive = op.id === activeOperationId;
        const toolRadius = op.tool.diameter / 2;

        ctx.lineWidth = (isOpActive ? 2.5 : 1.5) / scale;
        ctx.strokeStyle = isOpActive ? '#ffffff' : op.color;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (const seg of op.segments) {
          if (seg.points.length < 2) continue;

          ctx.beginPath();
          let segDrawn = false;

          for (let pIdx = 0; pIdx < seg.points.length - 1; pIdx++) {
            const p1 = seg.points[pIdx];
            const p2 = seg.points[pIdx + 1];
            const segLen = dist(p1, p2);

            if (playbackProgress < 1.0 && accumulatedDist > targetAnimDist) {
              break;
            }

            if (!segDrawn) {
              ctx.moveTo(p1.x, p1.y);
              segDrawn = true;
            }
            ctx.lineTo(p2.x, p2.y);

            // Track cutting head position during simulation
            if (accumulatedDist <= targetAnimDist && accumulatedDist + segLen >= targetAnimDist) {
              const localT = (targetAnimDist - accumulatedDist) / (segLen || 1);
              currentCutterPos = {
                x: p1.x + (p2.x - p1.x) * localT,
                y: p1.y + (p2.y - p1.y) * localT,
              };
              currentCutterRadius = toolRadius;
            }

            accumulatedDist += segLen;

            // Highlight Volumetric Safe Overtravel Extensions in Cyan
            if (showOvertravel && (p1.type === 'overtravel' || p2.type === 'overtravel')) {
              ctx.save();
              ctx.strokeStyle = '#06b6d4';
              ctx.lineWidth = 2.5 / scale;
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();
              ctx.restore();
            }
          }

          ctx.stroke();
        }
      }

      // 5. Draw Simulated Cutting Tool Head
      if (showCutterDisk && currentCutterPos) {
        ctx.save();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5 / scale;
        ctx.beginPath();
        ctx.arc(currentCutterPos.x, currentCutterPos.y, currentCutterRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1 / scale;
        ctx.beginPath();
        ctx.moveTo(currentCutterPos.x - 4 / scale, currentCutterPos.y);
        ctx.lineTo(currentCutterPos.x + 4 / scale, currentCutterPos.y);
        ctx.moveTo(currentCutterPos.x, currentCutterPos.y - 4 / scale);
        ctx.lineTo(currentCutterPos.x, currentCutterPos.y + 4 / scale);
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.restore();
    ctx.restore();
  }, [
    project,
    scale,
    offset,
    activeOperationId,
    playbackProgress,
    showRegions,
    showToolpaths,
    showOvertravel,
    showCutterDisk,
    isInch,
  ]);

  useEffect(() => {
    render();
  }, [render]);

  // Mouse handlers for Pan & Zoom
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const worldX = (e.clientX - rect.left - offset.x) / scale;
      const worldY = (e.clientY - rect.top - offset.y) / scale;
      setMousePos({ x: worldX, y: worldY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseCanvasX = e.clientX - rect.left;
    const mouseCanvasY = e.clientY - rect.top;

    const newScale = Math.max(minAllowedScale, Math.min(maxAllowedScale, scale * zoomFactor));

    setOffset({
      x: mouseCanvasX - (mouseCanvasX - offset.x) * (newScale / scale),
      y: mouseCanvasY - (mouseCanvasY - offset.y) * (newScale / scale),
    });
    setScale(newScale);
  };

  return (
    <div
      ref={containerRef}
      className="relative flex-1 w-full h-full bg-slate-950 overflow-hidden select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full cursor-crosshair block" />

      {/* Top Floating View Layer Controls */}
      <div className="absolute top-20 left-4 bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-1.5 flex items-center gap-1.5 text-xs text-slate-300 shadow-xl z-20">
        <button
          onClick={() => setShowRegions(!showRegions)}
          className={`chip cursor-pointer transition ${
            showRegions
              ? 'bg-blue-600/30 text-blue-300 border border-blue-500/50'
              : 'text-slate-500 hover:text-slate-300'
          }`}
          title="Toggle Target Depth Regions"
        >
          {showRegions ? (
            <Eye className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <EyeOff className="w-3.5 h-3.5 shrink-0" />
          )}
          <span>Depths</span>
        </button>

        <button
          onClick={() => setShowToolpaths(!showToolpaths)}
          className={`chip cursor-pointer transition ${
            showToolpaths
              ? 'bg-blue-600/30 text-blue-300 border border-blue-500/50'
              : 'text-slate-500 hover:text-slate-300'
          }`}
          title="Toggle Toolpaths"
        >
          {showToolpaths ? (
            <Eye className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <EyeOff className="w-3.5 h-3.5 shrink-0" />
          )}
          <span>Toolpaths</span>
        </button>

        <button
          onClick={() => setShowOvertravel(!showOvertravel)}
          className={`chip cursor-pointer transition ${
            showOvertravel
              ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/50'
              : 'text-slate-500 hover:text-slate-300'
          }`}
          title="Highlight Volumetric Safe Overtravels (Square Corners)"
        >
          <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
          <span>Safe Overtravel</span>
        </button>
      </div>

      {/* Zoom and Navigation Helpers */}
      <div className="absolute top-20 right-4 bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-1 flex flex-col gap-1 shadow-xl z-20">
        <button
          onClick={() => setScale((s) => Math.min(maxAllowedScale, s * 1.3))}
          className="btn-material p-2 hover:bg-slate-800 text-slate-300 rounded-xl"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4 shrink-0" />
        </button>
        <button
          onClick={() => setScale((s) => Math.max(minAllowedScale, s * 0.75))}
          className="btn-material p-2 hover:bg-slate-800 text-slate-300 rounded-xl"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4 shrink-0" />
        </button>
        <button
          onClick={fitToScreen}
          className="btn-material p-2 hover:bg-slate-800 text-slate-300 rounded-xl"
          title="Fit to Screen"
        >
          <Maximize2 className="w-4 h-4 shrink-0" />
        </button>
      </div>

      {/* Bottom Toolpath Playback Bar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-2xl border border-slate-800 rounded-2xl px-5 py-2.5 flex items-center gap-4 shadow-2xl z-20 w-[90%] max-w-xl">
        <button
          onClick={() => {
            if (playbackProgress >= 1.0) setPlaybackProgress(0);
            setIsPlaying(!isPlaying);
          }}
          className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition shrink-0"
          title={isPlaying ? 'Pause Simulation' : 'Play Toolpath Simulation'}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
        </button>

        <button
          onClick={() => {
            setIsPlaying(false);
            setPlaybackProgress(0);
          }}
          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition shrink-0"
          title="Reset Simulation"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Progress Slider */}
        <div className="flex-1 flex flex-col gap-1">
          <input
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={playbackProgress}
            onChange={(e) => {
              setPlaybackProgress(parseFloat(e.target.value));
              setIsPlaying(false);
            }}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>Pass Progress</span>
            <span>{(playbackProgress * 100).toFixed(0)}%</span>
          </div>
        </div>

        {/* Speed Selector */}
        <select
          value={playbackSpeed}
          onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
          className="bg-slate-800 text-slate-300 text-xs border border-slate-700 rounded-lg px-2 py-1 outline-none shrink-0"
        >
          <option value={0.5}>0.5x</option>
          <option value={1}>1.0x</option>
          <option value={2}>2.0x</option>
          <option value={5}>5.0x</option>
        </select>
      </div>

      {/* Coordinate Inspector Footer */}
      <div className="absolute bottom-3 left-4 text-[11px] text-slate-400 font-mono pointer-events-none bg-slate-900/90 px-2.5 py-1 rounded-xl border border-slate-800 shadow-sm z-20">
        {mousePos && (
          <span>
            X: {mousePos.x.toFixed(isInch ? 3 : 2)} {project.units} | Y:{' '}
            {mousePos.y.toFixed(isInch ? 3 : 2)} {project.units}
          </span>
        )}
      </div>
    </div>
  );
};

function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  units: string,
  scale: number
) {
  const isInch = units === 'inch';
  const step = isInch ? 1.0 : 20.0;
  const subStep = isInch ? (scale > 200 ? 0.125 : 0.25) : 5.0;

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 0.5 / scale;
  ctx.beginPath();
  for (let x = 0; x <= width + 1e-5; x += subStep) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = 0; y <= height + 1e-5; y += subStep) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();

  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1 / scale;
  ctx.beginPath();
  for (let x = 0; x <= width + 1e-5; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = 0; y <= height + 1e-5; y += step) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
}
