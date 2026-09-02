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
  distanceToPolygon,
  ensureOrientation,
} from '../geometry/polygon';
import { dist, pt, sub, normalize, add, scale, dot } from '../geometry/point';

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
      const n = baseOuter.length;
      const isExterior = region.sourceType === 'exterior';

      const detailPaths: ToolpathPoint[][] = [];

      // 1. For Interior Pockets: Clean tight concave corners where rough bit radius got stuck
      if (!isExterior) {
        for (let i = 0; i < n; i++) {
          const prev = baseOuter[(i - 1 + n) % n];
          const curr = baseOuter[i];
          const next = baseOuter[(i + 1) % n];

          const v1 = normalize(sub(curr, prev));
          const v2 = normalize(sub(next, curr));

          // In CCW polygon, a left turn (cross > 0) is an internal concave corner
          const crossVal = v1.x * v2.y - v1.y * v2.x;
          if (crossVal > 0.15) {
            const bisector = normalize(sub(scale(v1, -1), v2));

            const cosHalfAngle = Math.sqrt((1 + dot(scale(v1, -1), v2)) / 2);
            const roughCenterDist = roughRadius / (cosHalfAngle + 1e-4);
            const detailCenterDist = detailRadius / (cosHalfAngle + 1e-4);

            const roughCenter = add(curr, scale(bisector, -roughCenterDist));
            const detailCenter = add(curr, scale(bisector, -detailCenterDist));

            if (
              safeVolume.isToolCenterSafe(detailCenter, region.depth, detailRadius) &&
              dist(roughCenter, detailCenter) > 0.2
            ) {
              detailPaths.push([
                {
                  x: roughCenter.x,
                  y: roughCenter.y,
                  z: -region.depth,
                  type: 'cut',
                },
                {
                  x: detailCenter.x,
                  y: detailCenter.y,
                  z: -region.depth,
                  type: 'cut',
                },
              ]);
            }
          }
        }
      }

      // 2. Generate finishing contour pass with proper offset sign
      // Exterior: offset OUTWARD (-detailRadius). Interior/Pocket: offset INWARD (+detailRadius)
      const finishOffsetDelta = isExterior ? -detailRadius : detailRadius;
      const finishOffset = offsetPolygon(baseOuter, finishOffsetDelta, 'round');

      for (const loop of finishOffset) {
        if (loop.length >= 3) {
          const simplified = simplifyPolygon(loop, settings.simplifyTolerance || 0.05);
          const validLoop = simplified.filter(p =>
            safeVolume.isToolCenterSafe(p, region.depth, detailRadius)
          );
          if (validLoop.length >= 3) {
            const closed: ToolpathPoint[] = validLoop.map(p => ({
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
        const segments: ToolpathSegment[] = detailPaths.map(points => ({
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
