import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { CAMProject } from '../types';

interface Visualizer3DProps {
  project: CAMProject;
}

export const Visualizer3D: React.FC<Visualizer3DProps> = ({ project }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animId: number;
    let renderer: THREE.WebGLRenderer | null = null;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#080c14');

    // Camera
    const aspect = width / (height || 1);
    const stockW = project.width || (project.units === 'inch' ? 8 : 200);
    const stockH = project.height || (project.units === 'inch' ? 5 : 120);
    const stockThick = project.totalThickness || (project.units === 'inch' ? 0.75 : 12);
    const maxDim = Math.max(stockW, stockH, stockThick, 0.1);

    const camera = new THREE.PerspectiveCamera(45, aspect, maxDim * 0.01, maxDim * 50);
    camera.position.set(0, -maxDim * 1.35, maxDim * 1.25);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.shadowMap.enabled = true;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(maxDim, -maxDim * 1.5, maxDim * 2);
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x60a5fa, 0.4);
    fillLight.position.set(-maxDim, maxDim, -maxDim);
    scene.add(fillLight);

    // Workpiece Model Group
    const workpieceGroup = new THREE.Group();

    // 1. Stock Slab (Wood Maple Material)
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0xc89d66,
      roughness: 0.65,
      metalness: 0.05,
    });

    const stockGeo = new THREE.BoxGeometry(stockW, stockH, stockThick);
    const stockMesh = new THREE.Mesh(stockGeo, woodMat);
    stockMesh.position.set(0, 0, -stockThick / 2);
    workpieceGroup.add(stockMesh);

    // Stock Boundary Wireframe
    const wireGeo = new THREE.EdgesGeometry(stockGeo);
    const wireMat = new THREE.LineBasicMaterial({ color: 0x475569, linewidth: 1 });
    const wireMesh = new THREE.LineSegments(wireGeo, wireMat);
    wireMesh.position.set(0, 0, -stockThick / 2);
    workpieceGroup.add(wireMesh);

    // 2. Cut Pockets Cavities (Darker Wood Cut Surface)
    const cutMat = new THREE.MeshStandardMaterial({
      color: 0x825c34,
      roughness: 0.8,
      metalness: 0.0,
    });

    for (const region of project.regions) {
      if (region.sourceType === 'exterior' || region.depth <= 0) continue;
      const cutDepth = Math.min(stockThick, region.depth);

      for (const polyWithHoles of region.polygons) {
        const outer = polyWithHoles.outer;
        if (outer.length < 3) continue;

        try {
          const shape = new THREE.Shape();
          shape.moveTo(outer[0].x - stockW / 2, -(outer[0].y - stockH / 2));
          for (let i = 1; i < outer.length; i++) {
            shape.lineTo(outer[i].x - stockW / 2, -(outer[i].y - stockH / 2));
          }
          shape.closePath();

          const pocketGeo = new THREE.ExtrudeGeometry(shape, {
            depth: cutDepth,
            bevelEnabled: false,
          });

          const pocketMesh = new THREE.Mesh(pocketGeo, cutMat);
          pocketMesh.position.set(0, 0, 0.001 * maxDim);
          workpieceGroup.add(pocketMesh);
        } catch {
          // ignore any invalid shape geometries
        }
      }
    }

    // 3. Render 3D Toolpaths at Actual Cut Depths
    for (const op of project.operations) {
      if (!op.visible) continue;

      for (const seg of op.segments) {
        if (seg.points.length < 2) continue;

        const pts: THREE.Vector3[] = [];
        for (const p of seg.points) {
          pts.push(
            new THREE.Vector3(
              p.x - stockW / 2,
              -(p.y - stockH / 2),
              p.z + 0.005 * maxDim
            )
          );
        }

        const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
        const lineMat = new THREE.LineBasicMaterial({
          color: new THREE.Color(op.color),
          linewidth: 2,
        });
        const line = new THREE.Line(lineGeo, lineMat);
        workpieceGroup.add(line);
      }
    }

    scene.add(workpieceGroup);

    // Interactive Orbit
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

      workpieceGroup.rotation.z += deltaX * 0.01;
      workpieceGroup.rotation.x += deltaY * 0.01;
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

    // ResizeObserver
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
  }, [project]);

  return (
    <div className="relative flex-1 w-full h-full bg-slate-950 flex flex-col overflow-hidden select-none">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing block" />
      <div className="absolute top-20 left-4 bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-3 text-xs text-slate-300 shadow-xl pointer-events-none z-20">
        <span className="font-semibold text-blue-400 block">3D Machined Model</span>
        <p className="text-[11px] text-slate-400 mt-0.5">Drag to rotate • Scroll to zoom</p>
      </div>
    </div>
  );
};
