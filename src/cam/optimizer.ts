import { ToolpathOperation, ToolpathSegment, Point } from '../types';
import { dist } from '../geometry/point';

export interface OptimizationResult {
  orderedOperations: ToolpathOperation[];
  totalCutDistance: number;
  totalRapidDistance: number;
  totalEstimatedTimeSec: number;
  toolChangeCount: number;
}

/**
 * Optimizes the sequence of CAM operations to minimize tool changes and rapid transit distance.
 */
export function optimizeToolpathSequence(operations: ToolpathOperation[]): OptimizationResult {
  if (operations.length === 0) {
    return {
      orderedOperations: [],
      totalCutDistance: 0,
      totalRapidDistance: 0,
      totalEstimatedTimeSec: 0,
      toolChangeCount: 0,
    };
  }

  // Group operations by Tool ID
  const toolGroups = new Map<string, ToolpathOperation[]>();
  for (const op of operations) {
    const list = toolGroups.get(op.toolId) || [];
    list.push(op);
    toolGroups.set(op.toolId, list);
  }

  // Sort tools: larger diameter first (roughing) then smaller diameter (detail)
  const sortedToolIds = Array.from(toolGroups.keys()).sort((a, b) => {
    const toolA = toolGroups.get(a)![0].tool;
    const toolB = toolGroups.get(b)![0].tool;
    return toolB.diameter - toolA.diameter;
  });

  const finalOps: ToolpathOperation[] = [];
  let currentPos: Point = { x: 0, y: 0 };
  let totalRapidDist = 0;
  let totalCutDist = 0;
  let totalTime = 0;
  let toolChanges = 0;

  for (let tIdx = 0; tIdx < sortedToolIds.length; tIdx++) {
    if (tIdx > 0) toolChanges++;
    const toolOps = toolGroups.get(sortedToolIds[tIdx])!;

    // Sort operations within tool group: shallower pass depths first, then nearest neighbor
    toolOps.sort((a, b) => a.currentPassDepth - b.currentPassDepth);

    // Apply greedy Nearest-Neighbor ordering within same depth level
    const pending = [...toolOps];
    while (pending.length > 0) {
      let bestIdx = 0;
      let minTransit = Infinity;

      for (let i = 0; i < pending.length; i++) {
        const firstSeg = pending[i].segments[0];
        if (firstSeg && firstSeg.points.length > 0) {
          const startPt = firstSeg.points[0];
          const d = dist(currentPos, startPt);
          if (d < minTransit) {
            minTransit = d;
            bestIdx = i;
          }
        }
      }

      const selected = pending.splice(bestIdx, 1)[0];
      finalOps.push(selected);

      // Track distance and position
      totalCutDist += selected.estimatedLength;
      totalTime += selected.estimatedTimeSec;

      const lastSeg = selected.segments[selected.segments.length - 1];
      if (lastSeg && lastSeg.points.length > 0) {
        const endPt = lastSeg.points[lastSeg.points.length - 1];
        if (minTransit < Infinity) {
          totalRapidDist += minTransit;
        }
        currentPos = endPt;
      }
    }
  }

  return {
    orderedOperations: finalOps,
    totalCutDistance: totalCutDist,
    totalRapidDistance: totalRapidDist,
    totalEstimatedTimeSec: totalTime + toolChanges * 45, // assume 45s per tool swap
    toolChangeCount: toolChanges,
  };
}
