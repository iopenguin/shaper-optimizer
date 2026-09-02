import { Point, DepthRegion, BoundingBox, PolygonWithHoles, Polygon } from '../types';
import { pt, dist, add, sub, scale, normalize, dot, lerp } from '../geometry/point';
import {
  isPointInPolygon,
  isPointInPolygonWithHoles,
  distanceToPolygon,
} from '../geometry/polygon';

export class SafeVolumeManager {
  private regions: DepthRegion[];
  private stockBounds: BoundingBox;

  constructor(regions: DepthRegion[], stockBounds: BoundingBox) {
    this.regions = regions;
    this.stockBounds = stockBounds;
  }

  /**
   * Returns true if a tool center at point `p` cutting at depth `z` with radius `R`
   * does NOT collide with any obstacle of depth < z.
   */
  public isToolCenterSafe(p: Point, z: number, R: number, eps = 1e-4): boolean {
    for (const region of this.regions) {
      if (region.depth < z - eps) {
        // This region is shallower than z, so cutting into it at depth z would gouge it!
        for (const polyWithHoles of region.polygons) {
          // Check outer boundary
          const distInfo = distanceToPolygon(p, polyWithHoles.outer);
          if (distInfo.isInside) {
            // Center is inside obstacle -> gouge!
            return false;
          }
          if (distInfo.dist < R - eps) {
            // Cutter periphery penetrates obstacle -> gouge!
            return false;
          }

          // Check holes (if obstacle has holes, material inside hole might be deeper)
          for (const hole of polyWithHoles.holes) {
            const holeDist = distanceToPolygon(p, hole);
            if (!holeDist.isInside && holeDist.dist < R - eps) {
              return false;
            }
          }
        }
      }
    }

    return true;
  }

  /**
   * Computes the maximum safe extension along a direction vector `dir` from `startPoint`
   * up to `maxExtendDist` without gouging shallower material.
   */
  public computeSafeExtension(
    startPoint: Point,
    dir: Point,
    maxExtendDist: number,
    targetDepth: number,
    toolRadius: number,
    stepSize = 0.5
  ): number {
    const unitDir = normalize(dir);
    if (unitDir.x === 0 && unitDir.y === 0) return 0;

    let safeDist = 0;
    const totalSteps = Math.max(1, Math.ceil(maxExtendDist / stepSize));

    for (let i = 1; i <= totalSteps; i++) {
      const currentDist = Math.min(maxExtendDist, i * (maxExtendDist / totalSteps));
      const testPoint = add(startPoint, scale(unitDir, currentDist));

      if (this.isToolCenterSafe(testPoint, targetDepth, toolRadius)) {
        safeDist = currentDist;
      } else {
        // Hit obstacle, step back slightly
        break;
      }
    }

    return safeDist;
  }

  /**
   * Evaluates if a given slot end is adjacent to open air or a deeper pocket.
   */
  public isBoundaryOpen(endPoint: Point, normalDir: Point, targetDepth: number): boolean {
    const testDist = 1.0; // 1 unit probe
    const probePoint = add(endPoint, scale(normalize(normalDir), testDist));

    // Check if probe is outside stock bounds
    if (
      probePoint.x < this.stockBounds.minX ||
      probePoint.x > this.stockBounds.maxX ||
      probePoint.y < this.stockBounds.minY ||
      probePoint.y > this.stockBounds.maxY
    ) {
      return true; // Open to air
    }

    // Check if probe is inside a region with depth >= targetDepth
    for (const region of this.regions) {
      if (region.depth >= targetDepth) {
        for (const polyWithHoles of region.polygons) {
          if (isPointInPolygonWithHoles(probePoint, polyWithHoles)) {
            return true; // Open to deeper region
          }
        }
      }
    }

    return false;
  }
}
