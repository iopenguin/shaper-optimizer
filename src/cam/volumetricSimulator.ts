import * as THREE from 'three';
import { CAMProject, ToolDefinition, ToolpathOperation, ToolpathPoint } from '../types';
import { dist } from '../geometry/point';

export interface VolumetricSimulationResult {
  geometry: THREE.BufferGeometry;
  shankCollisions: {
    operationId: string;
    toolName: string;
    cutDepth: number;
    fluteLength: number;
    point: { x: number; y: number; z: number };
  }[];
}

/**
 * Multi-layer Volumetric CNC Machining Simulator.
 * Models true 3D tool sweeps, undercuts (dovetails, T-slots, finger pulls),
 * and dynamic material removal with exact coordinate alignment.
 */
export class VolumetricSimulator {
  private width: number;
  private height: number;
  private thickness: number;
  private nx: number;
  private ny: number;
  private cellDx: number;
  private cellDy: number;

  private gridTopZ: Float32Array; // Top surface Z (<= 0)
  private gridBottomZ: Float32Array; // Cut floor Z
  private gridCeilingZ: Float32Array; // Undercut ceiling Z
  private hasUndercut: Uint8Array; // 1 if cell has an undercut

  constructor(width: number, height: number, thickness: number, isInch = false) {
    this.width = Math.max(width, 1);
    this.height = Math.max(height, 1);
    this.thickness = Math.max(thickness, 0.1);

    // Resolution: ~4-5 samples per mm (or ~100 samples per inch)
    const targetPPM = isInch ? 80 : 3.5;
    this.nx = Math.min(500, Math.max(64, Math.round(this.width * targetPPM)));
    this.ny = Math.min(350, Math.max(64, Math.round(this.height * targetPPM)));

    this.cellDx = this.width / (this.nx - 1);
    this.cellDy = this.height / (this.ny - 1);

    const totalCells = this.nx * this.ny;
    this.gridTopZ = new Float32Array(totalCells);
    this.gridBottomZ = new Float32Array(totalCells);
    this.gridCeilingZ = new Float32Array(totalCells);
    this.hasUndercut = new Uint8Array(totalCells);
  }

  public reset() {
    this.gridTopZ.fill(0.0);
    this.gridBottomZ.fill(0.0);
    this.gridCeilingZ.fill(0.0);
    this.hasUndercut.fill(0);
  }

  /**
   * Simulates tool cutting along a segment (p1 -> p2) with active tool geometry.
   */
  public carveSegment(
    p1: ToolpathPoint,
    p2: ToolpathPoint,
    tool: ToolDefinition,
    cutDepth: number
  ) {
    const maxToolRadius = (tool.diameter || 6.35) / 2;
    const targetZ = -Math.abs(cutDepth);
    const isDovetailOrUndercut =
      tool.category === 'dovetail' ||
      tool.sections?.some((s) => (s.taperAngle && s.taperAngle < 0) || s.type === 'inside-arc');

    // Bounding box of segment in exact grid indices
    const minX = Math.max(0, Math.floor((Math.min(p1.x, p2.x) - maxToolRadius) / this.cellDx));
    const maxX = Math.min(this.nx - 1, Math.ceil((Math.max(p1.x, p2.x) + maxToolRadius) / this.cellDx));
    const minY = Math.max(0, Math.floor((Math.min(p1.y, p2.y) - maxToolRadius) / this.cellDy));
    const maxY = Math.min(this.ny - 1, Math.ceil((Math.max(p1.y, p2.y) + maxToolRadius) / this.cellDy));

    const segDx = p2.x - p1.x;
    const segDy = p2.y - p1.y;
    const segLenSq = segDx * segDx + segDy * segDy;

    for (let gy = minY; gy <= maxY; gy++) {
      const worldY = gy * this.cellDy;
      const rowOffset = gy * this.nx;

      for (let gx = minX; gx <= maxX; gx++) {
        const worldX = gx * this.cellDx;

        // Distance from (worldX, worldY) to segment (p1 -> p2)
        let t = 0;
        if (segLenSq > 1e-8) {
          t = Math.max(0, Math.min(1, ((worldX - p1.x) * segDx + (worldY - p1.y) * segDy) / segLenSq));
        }
        const projX = p1.x + t * segDx;
        const projY = p1.y + t * segDy;
        const distToCenter = Math.sqrt((worldX - projX) ** 2 + (worldY - projY) ** 2);

        if (distToCenter <= maxToolRadius) {
          const idx = rowOffset + gx;
          const toolCarve = this.evaluateToolProfileDepth(tool, distToCenter, targetZ);

          if (!isDovetailOrUndercut) {
            if (toolCarve.zFloor < this.gridTopZ[idx]) {
              this.gridTopZ[idx] = Math.max(-this.thickness, toolCarve.zFloor);
              this.gridBottomZ[idx] = this.gridTopZ[idx];
            }
          } else {
            if (toolCarve.zCeiling !== undefined && toolCarve.zCeiling < 0) {
              this.hasUndercut[idx] = 1;
              this.gridCeilingZ[idx] = Math.min(this.gridCeilingZ[idx] || 0, toolCarve.zCeiling);
              this.gridBottomZ[idx] = Math.max(-this.thickness, toolCarve.zFloor);
            } else {
              if (toolCarve.zFloor < this.gridTopZ[idx]) {
                this.gridTopZ[idx] = Math.max(-this.thickness, toolCarve.zFloor);
                this.gridBottomZ[idx] = this.gridTopZ[idx];
              }
            }
          }
        }
      }
    }
  }

  private evaluateToolProfileDepth(
    tool: ToolDefinition,
    distFromCenter: number,
    targetZ: number
  ): { zFloor: number; zCeiling?: number } {
    const sections = tool.sections || [];
    const maxR = (tool.diameter || 6.35) / 2;

    if (sections.length === 0 || tool.category === 'endmill' || sections[0].type === 'straight') {
      return { zFloor: targetZ };
    }

    const firstSec = sections[0];

    if (tool.category === 'v-bit' || firstSec.type === 'angled') {
      const taperAngle = firstSec.taperAngle || 60;
      const halfAngleRad = (taperAngle * Math.PI) / 360;
      const zOffset = distFromCenter / Math.tan(halfAngleRad);
      return { zFloor: Math.min(0, targetZ + zOffset) };
    }

    if (tool.category === 'ball-nose' || firstSec.type === 'outside-arc') {
      if (distFromCenter <= maxR) {
        const sphereHeight = maxR - Math.sqrt(Math.max(0, maxR * maxR - distFromCenter * distFromCenter));
        return { zFloor: Math.min(0, targetZ + sphereHeight) };
      }
      return { zFloor: 0 };
    }

    if (tool.category === 'dovetail' || (firstSec.taperAngle && firstSec.taperAngle < 0)) {
      const angleRad = (Math.abs(firstSec.taperAngle || 8) * Math.PI) / 180;
      const endR = (firstSec.endDiameter || tool.diameter * 0.75) / 2;

      if (distFromCenter <= endR) {
        return { zFloor: targetZ };
      } else if (distFromCenter <= maxR) {
        const undercutH = (distFromCenter - endR) / Math.tan(angleRad);
        const zCeil = Math.min(0, targetZ + firstSec.height - undercutH);
        return { zFloor: targetZ, zCeiling: zCeil };
      }
    }

    return { zFloor: targetZ };
  }

  public generateSurfaceMesh(): THREE.BufferGeometry {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const colors: number[] = [];

    const stockHalfW = this.width / 2;
    const stockHalfH = this.height / 2;

    // 1. Generate Top/Carved Surface Grid
    for (let gy = 0; gy < this.ny - 1; gy++) {
      for (let gx = 0; gx < this.nx - 1; gx++) {
        const idx00 = gy * this.nx + gx;
        const idx10 = gy * this.nx + (gx + 1);
        const idx01 = (gy + 1) * this.nx + gx;
        const idx11 = (gy + 1) * this.nx + (gx + 1);

        const x0 = gx * this.cellDx - stockHalfW;
        const x1 = (gx + 1) * this.cellDx - stockHalfW;
        const y0 = -(gy * this.cellDy - stockHalfH);
        const y1 = -((gy + 1) * this.cellDy - stockHalfH);

        const z00 = this.gridTopZ[idx00];
        const z10 = this.gridTopZ[idx10];
        const z01 = this.gridTopZ[idx01];
        const z11 = this.gridTopZ[idx11];

        addQuad(
          positions,
          normals,
          uvs,
          colors,
          x0, y0, z00,
          x1, y0, z10,
          x1, y1, z11,
          x0, y1, z01,
          gx / this.nx,
          gy / this.ny,
          (gx + 1) / this.nx,
          (gy + 1) / this.ny
        );

        // Lower floor for undercuts
        if (this.hasUndercut[idx00] || this.hasUndercut[idx10] || this.hasUndercut[idx01] || this.hasUndercut[idx11]) {
          const fb00 = this.gridBottomZ[idx00];
          const fb10 = this.gridBottomZ[idx10];
          const fb01 = this.gridBottomZ[idx01];
          const fb11 = this.gridBottomZ[idx11];

          addQuad(
            positions,
            normals,
            uvs,
            colors,
            x0, y0, fb00,
            x1, y0, fb10,
            x1, y1, fb11,
            x0, y1, fb01,
            gx / this.nx,
            gy / this.ny,
            (gx + 1) / this.nx,
            (gy + 1) / this.ny,
            true
          );
        }
      }
    }

    // 2. Outer Skirt Walls
    const zBase = -this.thickness;

    for (let gx = 0; gx < this.nx - 1; gx++) {
      const x0 = gx * this.cellDx - stockHalfW;
      const x1 = (gx + 1) * this.cellDx - stockHalfW;

      // North side
      const yn = -(0 - stockHalfH);
      const zn0 = this.gridTopZ[gx];
      const zn1 = this.gridTopZ[gx + 1];
      addWall(positions, normals, uvs, colors, x0, yn, zn0, x1, yn, zn1, zBase, 0, 1, 0);

      // South side
      const ys = -((this.ny - 1) * this.cellDy - stockHalfH);
      const zs0 = this.gridTopZ[(this.ny - 1) * this.nx + gx];
      const zs1 = this.gridTopZ[(this.ny - 1) * this.nx + gx + 1];
      addWall(positions, normals, uvs, colors, x1, ys, zs1, x0, ys, zs0, zBase, 0, -1, 0);
    }

    for (let gy = 0; gy < this.ny - 1; gy++) {
      const y0 = -(gy * this.cellDy - stockHalfH);
      const y1 = -((gy + 1) * this.cellDy - stockHalfH);

      // West side
      const xw = 0 - stockHalfW;
      const zw0 = this.gridTopZ[gy * this.nx];
      const zw1 = this.gridTopZ[(gy + 1) * this.nx];
      addWall(positions, normals, uvs, colors, xw, y1, zw1, xw, y0, zw0, zBase, -1, 0, 0);

      // East side
      const xe = (this.nx - 1) * this.cellDx - stockHalfW;
      const ze0 = this.gridTopZ[gy * this.nx + (this.nx - 1)];
      const ze1 = this.gridTopZ[(gy + 1) * this.nx + (this.nx - 1)];
      addWall(positions, normals, uvs, colors, xe, y0, ze0, xe, y1, ze1, zBase, 1, 0, 0);
    }

    // 3. Bottom Flat Floor Slab (-thickness)
    addQuad(
      positions,
      normals,
      uvs,
      colors,
      -stockHalfW, -stockHalfH, zBase,
      stockHalfW, -stockHalfH, zBase,
      stockHalfW, stockHalfH, zBase,
      -stockHalfW, stockHalfH, zBase,
      0, 0, 1, 1,
      false,
      0, 0, -1
    );

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    return geo;
  }
}

function addQuad(
  pos: number[],
  norm: number[],
  uv: number[],
  col: number[],
  x0: number, y0: number, z0: number,
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number,
  x3: number, y3: number, z3: number,
  u0: number, v0: number, u1: number, v1: number,
  forceDarkCut = false,
  nx = 0, ny = 0, nz = 1
) {
  pos.push(x0, y0, z0, x1, y1, z1, x2, y2, z2);
  norm.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
  uv.push(u0, v0, u1, v0, u1, v1);

  pos.push(x0, y0, z0, x2, y2, z2, x3, y3, z3);
  norm.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
  uv.push(u0, v0, u1, v1, u0, v1);

  for (let i = 0; i < 6; i++) {
    const isCut = forceDarkCut || z0 < -0.05 || z1 < -0.05 || z2 < -0.05;
    if (isCut) {
      col.push(0.55, 0.38, 0.22);
    } else {
      col.push(0.82, 0.68, 0.48);
    }
  }
}

function addWall(
  pos: number[],
  norm: number[],
  uv: number[],
  col: number[],
  x0: number, y0: number, zTop0: number,
  x1: number, y1: number, zTop1: number,
  zBase: number,
  nx: number, ny: number, nz: number
) {
  pos.push(x0, y0, zTop0, x1, y1, zTop1, x1, y1, zBase);
  norm.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
  uv.push(0, 0, 1, 0, 1, 1);

  pos.push(x0, y0, zTop0, x1, y1, zBase, x0, y0, zBase);
  norm.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
  uv.push(0, 0, 1, 1, 0, 1);

  for (let i = 0; i < 6; i++) {
    col.push(0.68, 0.52, 0.34);
  }
}

export function runVolumetricSimulation(
  project: CAMProject,
  progress = 1.0
): VolumetricSimulationResult {
  const isInch = project.units === 'inch';
  const sim = new VolumetricSimulator(
    project.width,
    project.height,
    project.totalThickness || (isInch ? 0.75 : 12),
    isInch
  );

  const shankCollisions: VolumetricSimulationResult['shankCollisions'] = [];

  let totalCutDist = 0;
  for (const op of project.operations) {
    if (op.visible) totalCutDist += op.estimatedLength;
  }

  const targetDist = totalCutDist * progress;
  let accumDist = 0;
  let done = false;

  for (const op of project.operations) {
    if (!op.visible || done) continue;
    const tool = op.tool;
    const cutDepth = op.currentPassDepth;

    const maxFluteLength = tool.fluteLength || (isInch ? 0.75 : 19.05);
    if (cutDepth > maxFluteLength + 1e-3) {
      const firstPt = op.segments[0]?.points[0] || { x: 0, y: 0, z: -cutDepth };
      shankCollisions.push({
        operationId: op.id,
        toolName: tool.name,
        cutDepth,
        fluteLength: maxFluteLength,
        point: { x: firstPt.x, y: firstPt.y, z: -cutDepth },
      });
    }

    for (const seg of op.segments) {
      if (seg.points.length < 2 || done) continue;

      for (let pIdx = 0; pIdx < seg.points.length - 1; pIdx++) {
        const p1 = seg.points[pIdx];
        const p2 = seg.points[pIdx + 1];
        const d = dist(p1, p2);

        if (progress < 1.0 && accumDist + d > targetDist) {
          // Partial segment interpolation
          const fraction = Math.max(0, (targetDist - accumDist) / (d || 1));
          const pPartial: ToolpathPoint = {
            x: p1.x + (p2.x - p1.x) * fraction,
            y: p1.y + (p2.y - p1.y) * fraction,
            z: p1.z + (p2.z - p1.z) * fraction,
          };
          sim.carveSegment(p1, pPartial, tool, cutDepth);
          done = true;
          break;
        }

        sim.carveSegment(p1, p2, tool, cutDepth);
        accumDist += d;
      }
    }
  }

  const geometry = sim.generateSurfaceMesh();

  return {
    geometry,
    shankCollisions,
  };
}
