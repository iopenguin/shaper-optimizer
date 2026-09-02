import {
  ToolDefinition,
  DepthRegion,
  ToolpathOperation,
  ToolpathSegment,
  ToolpathPoint,
  CAMSettings,
  BoundingBox,
  Polygon,
} from '../types';
import { SafeVolumeManager } from './safeVolume';
import {
  offsetPolygon,
  simplifyPolygon,
  ensureOrientation,
  isPointInPolygon,
} from '../geometry/polygon';
import { dist } from '../geometry/point';

export function generateRestMachiningOperations(
  regions: DepthRegion[],
  roughTool: ToolDefinition,
  detailTool: ToolDefinition,
  settings: CAMSettings,
  stockBounds: BoundingBox,
  safeVolume: SafeVolumeManager
): ToolpathOperation[] {
  const operations: ToolpathOperation[] = [];
  const roughRadius = roughTool.diameter / 2;
  const detailRadius = detailTool.diameter / 2;

  if (detailRadius >= roughRadius) return [];

  for (const region of regions) {
    if (region.depth <= 0) continue;

    for (let polyIdx = 0; polyIdx < region.polygons.length; polyIdx++) {
      const polyWithHoles = region.polygons[polyIdx];
      const baseOuter = ensureOrientation(polyWithHoles.outer, true);
      const isExterior = region.sourceType === 'exterior';

      const detailPaths: ToolpathPoint[][] = [];

      // Generate pristine finishing contour at detail bit radius
      // Exterior: offset OUTWARD (-detailRadius). Interior/Pocket: offset INWARD (+detailRadius)
      const finishOffsetDelta = isExterior ? -detailRadius : detailRadius;
      const finishLoops = offsetPolygon(baseOuter, finishOffsetDelta, 'round');

      for (const loop of finishLoops) {
        if (loop.length >= 3) {
          const simplified = simplifyPolygon(loop, settings.simplifyTolerance || 0.05);
          
          // Verify points stay strictly safe and inside pocket boundary if interior
          const validLoop = simplified.filter((p) => {
            if (!isExterior && !isPointInPolygon(p, baseOuter)) return false;
            return safeVolume.isToolCenterSafe(p, region.depth, detailRadius);
          });

          if (validLoop.length >= 3) {
            const closed: ToolpathPoint[] = validLoop.map((p) => ({
              x: p.x,
              y: p.y,
              z: -region.depth,
              type: 'cut',
            }));
            closed.push({
              x: validLoop[0].x,
              y: validLoop[0].y,
              z: -region.depth,
              type: 'cut',
            });
            detailPaths.push(closed);
          }
        }
      }

      if (detailPaths.length > 0) {
        const segments: ToolpathSegment[] = detailPaths.map((points) => ({
          type: 'cut',
          points,
          feedRate: detailTool.feedRate,
        }));

        let totalLength = 0;
        for (const seg of segments) {
          for (let i = 0; i < seg.points.length - 1; i++) {
            totalLength += dist(seg.points[i], seg.points[i + 1]);
          }
        }

        const estimatedTime = (totalLength / detailTool.feedRate) * 60;

        operations.push({
          id: `op_rest_${region.id}_p${polyIdx}`,
          name: `${region.name} - Rest Finishing (${detailTool.name})`,
          toolId: detailTool.id,
          tool: detailTool,
          targetDepth: region.depth,
          passIndex: 1,
          totalPasses: 1,
          currentPassDepth: region.depth,
          type: 'rest-finishing',
          segments,
          estimatedLength: totalLength,
          estimatedTimeSec: estimatedTime,
          visible: true,
          color: detailTool.color,
        });
      }
    }
  }

  return operations;
}
