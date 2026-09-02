import {
  ToolDefinition,
  DepthRegion,
  ToolpathOperation,
  ToolpathSegment,
  ToolpathPoint,
  CAMSettings,
  BoundingBox,
} from '../types';
import { analyzeSlot, extendCenterline } from '../geometry/medialAxis';
import { SafeVolumeManager } from './safeVolume';
import { dist, sub, normalize, add, scale } from '../geometry/point';

export function generateSlotOperations(
  regions: DepthRegion[],
  tool: ToolDefinition,
  settings: CAMSettings,
  stockBounds: BoundingBox,
  safeVolume: SafeVolumeManager
): { operations: ToolpathOperation[]; processedRegionIds: Set<string> } {
  const operations: ToolpathOperation[] = [];
  const processedRegionIds = new Set<string>();
  const toolRadius = tool.diameter / 2;

  for (const region of regions) {
    if (region.depth <= 0) continue;

    for (let polyIdx = 0; polyIdx < region.polygons.length; polyIdx++) {
      const polyWithHoles = region.polygons[polyIdx];
      // Only outer boundaries for slots
      const slotInfo = analyzeSlot(
        polyWithHoles.outer,
        tool.diameter,
        settings.slotDetectionTolerance
      );

      if (slotInfo && slotInfo.isSlot) {
        processedRegionIds.add(`${region.id}_${polyIdx}`);

        // Compute safe overtravel extension at start and end
        const rawCenterline = slotInfo.centerline;
        if (rawCenterline.length < 2) continue;

        const pStart = rawCenterline[0];
        const pNext = rawCenterline[1];
        const dirStart = normalize(sub(pStart, pNext)); // pointing out from start

        const pEnd = rawCenterline[rawCenterline.length - 1];
        const pPrev = rawCenterline[rawCenterline.length - 2];
        const dirEnd = normalize(sub(pEnd, pPrev)); // pointing out from end

        const maxOvertravel = toolRadius * settings.safeOvertravelMargin;

        const safeStartDist = safeVolume.computeSafeExtension(
          pStart,
          dirStart,
          maxOvertravel,
          region.depth,
          toolRadius
        );

        const safeEndDist = safeVolume.computeSafeExtension(
          pEnd,
          dirEnd,
          maxOvertravel,
          region.depth,
          toolRadius
        );

        const extendedLine = extendCenterline(rawCenterline, safeStartDist, safeEndDist);

        // Calculate stepdown passes
        const totalDepth = region.depth;
        const maxStepDown = tool.maxStepDown > 0 ? tool.maxStepDown : totalDepth;
        const numPasses = Math.max(1, Math.ceil(totalDepth / maxStepDown));

        for (let pass = 1; pass <= numPasses; pass++) {
          const passDepth = Math.min(totalDepth, pass * (totalDepth / numPasses));

          // Generate toolpath points
          const pathPoints: ToolpathPoint[] = extendedLine.map((pt, idx) => {
            const isOvertravel =
              (idx === 0 && safeStartDist > 0) ||
              (idx === extendedLine.length - 1 && safeEndDist > 0);
            return {
              x: pt.x,
              y: pt.y,
              z: -passDepth,
              type: isOvertravel ? 'overtravel' : 'cut',
            };
          });

          // Alternate cut direction per pass for efficient zigzag slotting
          const orderedPoints = pass % 2 === 0 ? [...pathPoints].reverse() : pathPoints;

          const segDist = dist(orderedPoints[0], orderedPoints[orderedPoints.length - 1]);
          const estimatedTime = (segDist / tool.feedRate) * 60; // seconds

          operations.push({
            id: `op_slot_${region.id}_pass${pass}`,
            name: `${region.name} - Slot Pass ${pass}/${numPasses} (-${passDepth.toFixed(2)})`,
            toolId: tool.id,
            tool,
            targetDepth: region.depth,
            passIndex: pass,
            totalPasses: numPasses,
            currentPassDepth: passDepth,
            type: 'centerline-slot',
            segments: [
              {
                type: 'cut',
                points: orderedPoints,
                feedRate: tool.feedRate,
              },
            ],
            estimatedLength: segDist,
            estimatedTimeSec: estimatedTime,
            visible: true,
            color: tool.color,
          });
        }
      }
    }
  }

  return { operations, processedRegionIds };
}
