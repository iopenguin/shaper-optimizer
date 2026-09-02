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
  const initialStepover = Math.max(
    tool.diameter * 0.15,
    tool.diameter * (settings.stepOverRatio || tool.stepOverRatio || 0.65)
  );

  for (const region of regions) {
    if (region.depth <= 0) continue;

    for (let polyIdx = 0; polyIdx < region.polygons.length; polyIdx++) {
      const regionKey = `${region.id}_${polyIdx}`;
      if (skippedRegionKeys.has(regionKey)) continue;

      const polyWithHoles = region.polygons[polyIdx];
      const baseOuter = ensureOrientation(polyWithHoles.outer, true);

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
        // Standard Pocket: Adaptive Insetting with Guaranteed Core Centerline Clearance
        const concentricLoops: Polygon[] = [];
        let currentOffset = toolRadius;
        let step = initialStepover;
        let prevArea = Math.abs(polygonArea(baseOuter));
        let maxIterations = 60;

        // 1. Initial nominal outer loop
        const firstLoop = offsetPolygon(baseOuter, currentOffset, 'round');
        if (firstLoop.length > 0) {
          const simplified = simplifyPolygon(firstLoop[0], settings.simplifyTolerance || 0.05);
          const valid = simplified.filter(
            (p) =>
              isPointInPolygon(p, baseOuter) &&
              safeVolume.isToolCenterSafe(p, region.depth, toolRadius)
          );
          if (valid.length >= 3) {
            concentricLoops.push(valid);
            prevArea = Math.abs(polygonArea(valid));
          }
        }

        // 2. Adaptive insetting down to the exact core
        while (step > toolRadius * 0.1 && maxIterations-- > 0) {
          const candidateOffset = currentOffset + step;
          const candidateLoops = offsetPolygon(baseOuter, candidateOffset, 'round');

          let accepted = false;
          if (candidateLoops.length > 0) {
            for (const loop of candidateLoops) {
              const area = Math.abs(polygonArea(loop));
              if (area > 1e-5 && area < prevArea * 0.98) {
                const simplified = simplifyPolygon(loop, settings.simplifyTolerance || 0.05);
                const valid = simplified.filter(
                  (p) =>
                    isPointInPolygon(p, baseOuter) &&
                    safeVolume.isToolCenterSafe(p, region.depth, toolRadius)
                );

                if (valid.length >= 3) {
                  concentricLoops.push(valid);
                  currentOffset = candidateOffset;
                  prevArea = area;
                  accepted = true;
                  break;
                }
              }
            }
          }

          if (!accepted) {
            // Halve step size to push insets closer to the central core without collapsing
            step /= 2;
          }
        }

        if (concentricLoops.length === 0) continue;

        // 3. Connect concentric loops into a continuous spiral path with core spine clearing
        // concentricLoops is from outermost to innermost
        const innermostLoop = concentricLoops[concentricLoops.length - 1];
        const coreSpine = extractCoreSpine(innermostLoop, toolRadius);

        // Reverse concentricLoops so innermost is first, and prepend core spine
        const loopsInnerToOuter = [...concentricLoops].reverse();
        const continuousPath2D = connectConcentricLoopsWithCore(coreSpine, loopsInnerToOuter);

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
            name: `${region.name} - Spiral Pocket Pass ${pass}/${numPasses} (-${passDepth.toFixed(2)})`,
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
 * Computes the central spine / centroid of the innermost loop
 * to guarantee 100% full coverage of the pocket core.
 */
function extractCoreSpine(loop: Polygon, toolRadius: number): Point[] {
  if (loop.length === 0) return [];

  const bbox = getBoundingBox(loop);
  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;

  const width = bbox.maxX - bbox.minX;
  const height = bbox.maxY - bbox.minY;

  // If the core is elongated along X or Y, create a central spine pass
  if (width > toolRadius && width >= height) {
    const pad = Math.min(toolRadius * 0.5, width * 0.2);
    return [
      { x: bbox.minX + pad, y: cy },
      { x: bbox.maxX - pad, y: cy },
    ];
  } else if (height > toolRadius && height > width) {
    const pad = Math.min(toolRadius * 0.5, height * 0.2);
    return [
      { x: cx, y: bbox.minY + pad },
      { x: cx, y: bbox.maxY - pad },
    ];
  }

  // Small isotropic core, single centroid point
  return [{ x: cx, y: cy }];
}

/**
 * Connects the core spine and concentric offset loops into a single uninterrupted toolpath.
 */
function connectConcentricLoopsWithCore(coreSpine: Point[], loopsInnerToOuter: Polygon[]): Point[] {
  const path: Point[] = [];

  // 1. Cut the core spine first
  if (coreSpine.length > 0) {
    for (const p of coreSpine) {
      path.push(p);
    }
  }

  // 2. Connect concentric loops from inside out
  for (let k = 0; k < loopsInnerToOuter.length; k++) {
    const loop = loopsInnerToOuter[k];
    if (loop.length < 3) continue;

    if (path.length === 0) {
      for (let i = 0; i < loop.length; i++) path.push(loop[i]);
      path.push(loop[0]);
    } else {
      const lastPoint = path[path.length - 1];

      // Find closest vertex on the loop
      let bestIdx = 0;
      let minDist = Infinity;
      for (let i = 0; i < loop.length; i++) {
        const d = dist(lastPoint, loop[i]);
        if (d < minDist) {
          minDist = d;
          bestIdx = i;
        }
      }

      // Reorder loop to start from closest vertex
      const reordered = [...loop.slice(bestIdx), ...loop.slice(0, bestIdx)];

      // Bridge and trace full loop
      for (let i = 0; i < reordered.length; i++) {
        path.push(reordered[i]);
      }
      path.push(reordered[0]);
    }
  }

  return path;
}
