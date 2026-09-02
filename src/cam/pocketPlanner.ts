import {
  ToolDefinition,
  DepthRegion,
  ToolpathOperation,
  ToolpathSegment,
  ToolpathPoint,
  CAMSettings,
  BoundingBox,
  Polygon,
  Point,
} from '../types';
import { SafeVolumeManager } from './safeVolume';
import {
  offsetPolygon,
  simplifyPolygon,
  polygonArea,
  ensureOrientation,
  isPointInPolygon,
} from '../geometry/polygon';
import { dist, pt, getBoundingBox } from '../geometry/point';

export function generatePocketOperations(
  regions: DepthRegion[],
  tool: ToolDefinition,
  settings: CAMSettings,
  stockBounds: BoundingBox,
  safeVolume: SafeVolumeManager,
  skippedRegionKeys: Set<string>
): ToolpathOperation[] {
  const operations: ToolpathOperation[] = [];
  const toolRadius = tool.diameter / 2;
  const stepover = Math.max(
    tool.diameter * 0.15,
    tool.diameter * (settings.stepOverRatio || tool.stepOverRatio || 0.65)
  );

  for (const region of regions) {
    if (region.depth <= 0) continue;

    for (let polyIdx = 0; polyIdx < region.polygons.length; polyIdx++) {
      const regionKey = `${region.id}_${polyIdx}`;
      if (skippedRegionKeys.has(regionKey)) continue;

      const polyWithHoles = region.polygons[polyIdx];
      const baseOuter = ensureOrientation(polyWithHoles.outer, true); // CCW for outer

      if (region.sourceType === 'exterior') {
        // Exterior profile contour: offset outwards by toolRadius (-delta)
        const exteriorLoops = offsetPolygon(baseOuter, -toolRadius, 'round');
        for (const loop of exteriorLoops) {
          const simplified = simplifyPolygon(loop, settings.simplifyTolerance || 0.05);
          if (simplified.length >= 3) {
            const numPasses = Math.max(
              1,
              Math.ceil(region.depth / (tool.maxStepDown || region.depth))
            );
            for (let pass = 1; pass <= numPasses; pass++) {
              const passDepth = Math.min(region.depth, pass * (region.depth / numPasses));
              const closed: ToolpathPoint[] = simplified.map((p) => ({
                x: p.x,
                y: p.y,
                z: -passDepth,
                type: 'cut',
              }));
              closed.push({ x: simplified[0].x, y: simplified[0].y, z: -passDepth, type: 'cut' });

              let len = 0;
              for (let i = 0; i < closed.length - 1; i++) len += dist(closed[i], closed[i + 1]);

              operations.push({
                id: `op_profile_${region.id}_p${polyIdx}_pass${pass}`,
                name: `${region.name} - Exterior Profile Pass ${pass}/${numPasses} (-${passDepth.toFixed(2)})`,
                toolId: tool.id,
                tool,
                targetDepth: region.depth,
                passIndex: pass,
                totalPasses: numPasses,
                currentPassDepth: passDepth,
                type: 'profile-contour',
                segments: [{ type: 'cut', points: closed, feedRate: tool.feedRate }],
                estimatedLength: len,
                estimatedTimeSec: (len / tool.feedRate) * 60,
                visible: true,
                color: tool.color,
              });
            }
          }
        }
      } else if (region.sourceType === 'interior') {
        // Interior hole cutout: offset inwards by toolRadius (+delta)
        const interiorLoops = offsetPolygon(baseOuter, toolRadius, 'round');
        for (const loop of interiorLoops) {
          const simplified = simplifyPolygon(loop, settings.simplifyTolerance || 0.05);
          if (simplified.length >= 3) {
            const numPasses = Math.max(
              1,
              Math.ceil(region.depth / (tool.maxStepDown || region.depth))
            );
            for (let pass = 1; pass <= numPasses; pass++) {
              const passDepth = Math.min(region.depth, pass * (region.depth / numPasses));
              const closed: ToolpathPoint[] = simplified.map((p) => ({
                x: p.x,
                y: p.y,
                z: -passDepth,
                type: 'cut',
              }));
              closed.push({ x: simplified[0].x, y: simplified[0].y, z: -passDepth, type: 'cut' });

              let len = 0;
              for (let i = 0; i < closed.length - 1; i++) len += dist(closed[i], closed[i + 1]);

              operations.push({
                id: `op_interior_${region.id}_p${polyIdx}_pass${pass}`,
                name: `${region.name} - Interior Cutout Pass ${pass}/${numPasses} (-${passDepth.toFixed(2)})`,
                toolId: tool.id,
                tool,
                targetDepth: region.depth,
                passIndex: pass,
                totalPasses: numPasses,
                currentPassDepth: passDepth,
                type: 'profile-contour',
                segments: [{ type: 'cut', points: closed, feedRate: tool.feedRate }],
                estimatedLength: len,
                estimatedTimeSec: (len / tool.feedRate) * 60,
                visible: true,
                color: tool.color,
              });
            }
          }
        }
      } else {
        // Standard Pocket: Generate concentric shape-conforming offset loops and connect into a single continuous path
        const concentricLoops: Polygon[] = [];
        let currentOffset = toolRadius;
        let currentInsects = offsetPolygon(baseOuter, currentOffset, 'round');

        let maxIterations = 40;
        let prevArea = Math.abs(polygonArea(baseOuter));

        while (currentInsects.length > 0 && maxIterations-- > 0) {
          let hasValidLoop = false;

          for (const loop of currentInsects) {
            const area = Math.abs(polygonArea(loop));
            if (area > 1e-5 && area < prevArea) {
              const simplified = simplifyPolygon(loop, settings.simplifyTolerance || 0.05);
              const validPoints = simplified.filter(
                (p) =>
                  isPointInPolygon(p, baseOuter) &&
                  safeVolume.isToolCenterSafe(p, region.depth, toolRadius)
              );

              if (validPoints.length >= 3) {
                concentricLoops.push(validPoints);
                hasValidLoop = true;
                prevArea = area;
              }
            }
          }

          if (!hasValidLoop) break;

          currentOffset += stepover;
          currentInsects = offsetPolygon(baseOuter, currentOffset, 'round');
        }

        if (concentricLoops.length === 0) continue;

        // Connect concentric offset loops into a single continuous spiral path
        // Order from innermost (center) to outermost (perimeter)
        const loopsInnerToOuter = [...concentricLoops].reverse();
        const continuousPath2D = connectConcentricLoopsIntoSpiral(loopsInnerToOuter);

        if (continuousPath2D.length < 2) continue;

        const totalDepth = region.depth;
        const maxStepDown = tool.maxStepDown > 0 ? tool.maxStepDown : totalDepth;
        const numPasses = Math.max(1, Math.ceil(totalDepth / maxStepDown));

        for (let pass = 1; pass <= numPasses; pass++) {
          const passDepth = Math.min(totalDepth, pass * (totalDepth / numPasses));

          const spiralPoints: ToolpathPoint[] = continuousPath2D.map((p) => ({
            x: p.x,
            y: p.y,
            z: -passDepth,
            type: 'cut',
          }));

          let totalLength = 0;
          for (let i = 0; i < spiralPoints.length - 1; i++) {
            totalLength += dist(spiralPoints[i], spiralPoints[i + 1]);
          }

          const estimatedTime = (totalLength / tool.feedRate) * 60;

          operations.push({
            id: `op_pocket_${region.id}_p${polyIdx}_pass${pass}`,
            name: `${region.name} - Continuous Spiral Pocket Pass ${pass}/${numPasses} (-${passDepth.toFixed(2)})`,
            toolId: tool.id,
            tool,
            targetDepth: region.depth,
            passIndex: pass,
            totalPasses: numPasses,
            currentPassDepth: passDepth,
            type: 'pocket-clear',
            segments: [
              {
                type: 'cut',
                points: spiralPoints,
                feedRate: tool.feedRate,
              },
            ],
            estimatedLength: totalLength,
            estimatedTimeSec: estimatedTime,
            visible: true,
            color: tool.color,
          });
        }
      }
    }
  }

  return operations;
}

/**
 * Connects concentric polygon offset loops into a single continuous, shape-conforming spiral path.
 * Bridges each loop to the next loop at the closest vertex so the cutter never leaves the pocket
 * and traces the exact geometry (rectangles, stars, arbitrary polygons) in one uninterrupted stroke.
 */
function connectConcentricLoopsIntoSpiral(loops: Polygon[]): Point[] {
  if (loops.length === 0) return [];
  if (loops.length === 1) {
    const l = loops[0];
    return [...l, l[0]];
  }

  const path: Point[] = [];

  for (let k = 0; k < loops.length; k++) {
    const loop = loops[k];
    if (loop.length < 3) continue;

    if (path.length === 0) {
      // Start with the first loop
      for (let i = 0; i < loop.length; i++) {
        path.push(loop[i]);
      }
      path.push(loop[0]); // close loop
    } else {
      const lastPoint = path[path.length - 1];

      // Find closest vertex on the next loop to minimize transition distance
      let bestIdx = 0;
      let minDist = Infinity;
      for (let i = 0; i < loop.length; i++) {
        const d = dist(lastPoint, loop[i]);
        if (d < minDist) {
          minDist = d;
          bestIdx = i;
        }
      }

      // Reorder loop to start from bestIdx
      const reordered = [...loop.slice(bestIdx), ...loop.slice(0, bestIdx)];

      // Step directly to the entry vertex
      path.push(reordered[0]);

      // Complete full circuit around the contour
      for (let i = 1; i < reordered.length; i++) {
        path.push(reordered[i]);
      }
      path.push(reordered[0]);
    }
  }

  return path;
}
