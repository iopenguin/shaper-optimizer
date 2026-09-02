import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  Play,
  Pause,
  RotateCcw,
  AlertTriangle,
  Layers,
  Sparkles,
  Eye,
  EyeOff,
  Maximize2,
} from 'lucide-react';
import { CAMProject, Point } from '../types';
import { runVolumetricSimulation, VolumetricSimulationResult } from '../cam/volumetricSimulator';
import { dist } from '../geometry/point';

interface Visualizer3DProps {
  project: CAMProject;
  activeOperationId?: string;
}

export const Visualizer3D: React.FC<Visualizer3DProps> = ({
  project,
  activeOperationId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackProgress, setPlaybackProgress] = useState<number>(1.0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const animFrameRef = useRef<number | null>(null);

  // Display toggles
  const [showToolpaths, setShowToolpaths] = useState<boolean>(true);
  const [showToolHead, setShowToolHead] = useState<boolean>(true);

  // Simulation collisions
  const [collisions, setCollisions] = useState<VolumetricSimulationResult['shankCollisions']>([]);

  const isInch = project.units === 'inch';
  const stockW = project.width || (isInch ? 8 : 200);
  const stockH = project.height || (isInch ? 5 : 120);
  const stockThick = project.totalThickness || (isInch ? 0.75 : 12);
  const maxDim = Math.max(stockW, stockH, stockThick, 0.1);

  // Smooth, realistic playback loop
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
        // Base rate: ~50 seconds for full simulation at 1.0x speed
        const speedMultiplier = playbackSpeed * 0.02;
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

  // Main Three.js Scene Setup & Render
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animId: number;
    let renderer: THREE.WebGLRenderer | null = null;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#080c14');

    const aspect = width / (height || 1);
    const camera = new THREE.PerspectiveCamera(45, aspect, maxDim * 0.01, maxDim * 50);
    camera.position.set(0, -maxDim * 1.35, maxDim * 1.25);
    camera.lookAt(0, 0, -stockThick / 2);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.shadowMap.enabled = true;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.95);
    dirLight.position.set(maxDim * 1.2, -maxDim * 1.5, maxDim * 2.5);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x60a5fa, 0.45);
    fillLight.position.set(-maxDim, maxDim * 1.2, -maxDim);
    scene.add(fillLight);

    // 3. Workpiece Group
    const workpieceGroup = new THREE.Group();

    // Run Volumetric Carving
    const simResult = runVolumetricSimulation(project, playbackProgress);
    setCollisions(simResult.shankCollisions);

    // Realistic Wood Material with Vertex Colors
    const woodMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.65,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });

    const stockMesh = new THREE.Mesh(simResult.geometry, woodMat);
    workpieceGroup.add(stockMesh);

    // Stock Boundary Wireframe
    const wireBoxGeo = new THREE.BoxGeometry(stockW, stockH, stockThick);
    const wireEdges = new THREE.EdgesGeometry(wireBoxGeo);
    const wireMat = new THREE.LineBasicMaterial({ color: 0x334155, linewidth: 1 });
    const wireMesh = new THREE.LineSegments(wireEdges, wireMat);
    wireMesh.position.set(0, 0, -stockThick / 2);
    workpieceGroup.add(wireMesh);

    // 4. Render 3D Toolpaths at exact cut depths
    let currentCutterPos: { x: number; y: number; z: number } | null = null;
    let currentTool: any = null;

    if (showToolpaths) {
      let totalCutDist = 0;
      for (const op of project.operations) {
        if (op.visible) totalCutDist += op.estimatedLength;
      }

      let accumDist = 0;
      const targetAnimDist = totalCutDist * playbackProgress;

      for (const op of project.operations) {
        if (!op.visible) continue;

        for (const seg of op.segments) {
          if (seg.points.length < 2) continue;

          const pts: THREE.Vector3[] = [];
          for (let pIdx = 0; pIdx < seg.points.length - 1; pIdx++) {
            const p1 = seg.points[pIdx];
            const p2 = seg.points[pIdx + 1];
            const d = dist(p1, p2);

            pts.push(
              new THREE.Vector3(
                p1.x - stockW / 2,
                -(p1.y - stockH / 2),
                p1.z + 0.005 * maxDim
              )
            );

            // Track active cutting tool head
            if (accumDist <= targetAnimDist && accumDist + d >= targetAnimDist) {
              const t = (targetAnimDist - accumDist) / (d || 1);
              currentCutterPos = {
                x: p1.x + (p2.x - p1.x) * t - stockW / 2,
                y: -(p1.y + (p2.y - p1.y) * t - stockH / 2),
                z: p1.z + (p2.z - p1.z) * t,
              };
              currentTool = op.tool;
            }

            accumDist += d;
            if (playbackProgress < 1.0 && accumDist > targetAnimDist) {
              // Add final interpolated point
              if (currentCutterPos) {
                pts.push(
                  new THREE.Vector3(
                    currentCutterPos.x,
                    currentCutterPos.y,
                    currentCutterPos.z + 0.005 * maxDim
                  )
                );
              }
              break;
            }
          }

          if (pts.length >= 2) {
            const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
            const lineMat = new THREE.LineBasicMaterial({
              color: new THREE.Color(op.color),
              linewidth: 2,
            });
            const line = new THREE.Line(lineGeo, lineMat);
            workpieceGroup.add(line);
          }

          if (playbackProgress < 1.0 && accumDist > targetAnimDist) {
            break;
          }
        }

        if (playbackProgress < 1.0 && accumDist > targetAnimDist) {
          break;
        }
      }
    }

    // 5. Render 3D Router Spindle & Bit Model at Cut Head
    if (showToolHead && currentCutterPos) {
      const toolAssembly = new THREE.Group();
      const toolDia = currentTool?.diameter || (isInch ? 0.25 : 6.35);
      const colletDia = currentTool?.colletDiameter || toolDia;
      const fluteH = currentTool?.fluteLength || (isInch ? 0.75 : 19.05);

      // Carbide Flutes Cylinder
      const fluteGeo = new THREE.CylinderGeometry(
        toolDia / 2,
        toolDia / 2,
        fluteH,
        16
      );
      const fluteMat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        metalness: 0.85,
        roughness: 0.2,
      });
      const fluteMesh = new THREE.Mesh(fluteGeo, fluteMat);
      fluteMesh.rotation.x = Math.PI / 2;
      fluteMesh.position.z = fluteH / 2;
      toolAssembly.add(fluteMesh);

      // Steel Shank
      const shankH = fluteH * 0.8;
      const shankGeo = new THREE.CylinderGeometry(
        colletDia / 2,
        colletDia / 2,
        shankH,
        16
      );
      const shankMat = new THREE.MeshStandardMaterial({
        color: 0x64748b,
        metalness: 0.9,
        roughness: 0.15,
      });
      const shankMesh = new THREE.Mesh(shankGeo, shankMat);
      shankMesh.rotation.x = Math.PI / 2;
      shankMesh.position.z = fluteH + shankH / 2;
      toolAssembly.add(shankMesh);

      // Spindle Collet Chuck
      const colletGeo = new THREE.CylinderGeometry(
        colletDia * 1.5,
        colletDia * 1.1,
        shankH * 0.8,
        16
      );
      const colletMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.7,
        roughness: 0.3,
      });
      const colletMesh = new THREE.Mesh(colletGeo, colletMat);
      colletMesh.rotation.x = Math.PI / 2;
      colletMesh.position.z = fluteH + shankH + (shankH * 0.8) / 2;
      toolAssembly.add(colletMesh);

      toolAssembly.position.set(
        currentCutterPos.x,
        currentCutterPos.y,
        currentCutterPos.z
      );
      workpieceGroup.add(toolAssembly);
    }

    scene.add(workpieceGroup);

    // 6. Interactive Orbit Controls
    let isMouseDown = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    const handleMouseDown = (e: MouseEvent) => {
      isMouseDown = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isMouseDown) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      workpieceGroup.rotation.z += deltaX * 0.008;
      workpieceGroup.rotation.x += deltaY * 0.008;
    };

    const handleMouseUp = () => {
      isMouseDown = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 1.08 : 0.92;
      camera.position.multiplyScalar(zoomFactor);
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    domEl.addEventListener('wheel', handleWheel);

    const resizeObserver = new ResizeObserver(() => {
      if (!container || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    resizeObserver.observe(container);

    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (renderer) {
        renderer.render(scene, camera);
      }
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      domEl.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      domEl.removeEventListener('wheel', handleWheel);
      if (renderer) {
        renderer.dispose();
      }
    };
  }, [
    project,
    playbackProgress,
    showToolpaths,
    showToolHead,
    stockW,
    stockH,
    stockThick,
    maxDim,
    isInch,
  ]);

  return (
    <div className="relative flex-1 w-full h-full bg-slate-950 flex flex-col overflow-hidden select-none">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing block" />

      {/* Top Floating View Controls */}
      <div className="absolute top-20 left-4 bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-1.5 flex items-center gap-1.5 text-xs text-slate-300 shadow-xl z-20">
        <button
          onClick={() => setShowToolpaths(!showToolpaths)}
          className={`chip cursor-pointer transition ${
            showToolpaths
              ? 'bg-blue-600/30 text-blue-300 border border-blue-500/50'
              : 'text-slate-500 hover:text-slate-300'
          }`}
          title="Toggle 3D Toolpaths"
        >
          {showToolpaths ? (
            <Eye className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <EyeOff className="w-3.5 h-3.5 shrink-0" />
          )}
          <span>3D Toolpaths</span>
        </button>

        <button
          onClick={() => setShowToolHead(!showToolHead)}
          className={`chip cursor-pointer transition ${
            showToolHead
              ? 'bg-blue-600/30 text-blue-300 border border-blue-500/50'
              : 'text-slate-500 hover:text-slate-300'
          }`}
          title="Toggle 3D Spindle Cutter Model"
        >
          {showToolHead ? (
            <Eye className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <EyeOff className="w-3.5 h-3.5 shrink-0" />
          )}
          <span>Cutter Head</span>
        </button>
      </div>

      {/* Shank / Collet Collision Alert HUD */}
      {collisions.length > 0 && (
        <div className="absolute top-20 right-4 bg-red-950/90 backdrop-blur-xl border border-red-800/80 rounded-2xl p-3 text-xs text-red-200 shadow-2xl z-20 flex items-start gap-2 max-w-sm">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-red-300 block">Shank Rub Warning</span>
            <p className="text-[11px] text-red-300/80 mt-0.5">
              Cut depth (-{collisions[0].cutDepth.toFixed(2)}{project.units}) exceeds tool flute length (
              {collisions[0].fluteLength.toFixed(2)}{project.units}) on {collisions[0].toolName}. Smooth shank may rub material!
            </p>
          </div>
        </div>
      )}

      {/* Bottom 3D Toolpath Simulation Playhead Bar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-2xl border border-slate-800 rounded-2xl px-5 py-2.5 flex items-center gap-4 shadow-2xl z-20 w-[90%] max-w-xl">
        <button
          onClick={() => {
            if (playbackProgress >= 1.0) setPlaybackProgress(0);
            setIsPlaying(!isPlaying);
          }}
          className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition shrink-0"
          title={isPlaying ? 'Pause 3D Machining' : 'Play 3D Machining Simulation'}
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
            <span>Machining Progress</span>
            <span>{(playbackProgress * 100).toFixed(0)}%</span>
          </div>
        </div>

        {/* Speed Selector */}
        <select
          value={playbackSpeed}
          onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
          className="bg-slate-800 text-slate-300 text-xs border border-slate-700 rounded-lg px-2 py-1 outline-none shrink-0"
        >
          <option value={0.25}>0.25x (Slow)</option>
          <option value={0.5}>0.5x</option>
          <option value={1.0}>1.0x (Normal)</option>
          <option value={2.0}>2.0x</option>
          <option value={5.0}>5.0x</option>
        </select>
      </div>

      {/* Orbit Helper Badge */}
      <div className="absolute bottom-3 left-4 text-[11px] text-slate-400 font-mono pointer-events-none bg-slate-900/90 px-2.5 py-1 rounded-xl border border-slate-800 shadow-sm z-20">
        <span>3D Machining Simulator • Drag to Orbit • Scroll to Zoom</span>
      </div>
    </div>
  );
};
