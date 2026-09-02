import { CAMProject, ToolpathOperation, ToolDefinition } from '../types';
import { SafeVolumeManager } from './safeVolume';
import { generateSlotOperations } from './slotPlanner';
import { generatePocketOperations } from './pocketPlanner';
import { generateRestMachiningOperations } from './restMachining';
import { optimizeToolpathSequence } from './optimizer';

export function runCAMPipeline(project: CAMProject): CAMProject {
  const { regions, tools, settings, width, height } = project;
  const enabledTools = tools.filter(t => t.enabled !== false);

  if (enabledTools.length === 0 || regions.length === 0) {
    return {
      ...project,
      operations: [],
    };
  }

  // Sort enabled tools by diameter descending
  const sortedTools = [...enabledTools].sort((a, b) => b.diameter - a.diameter);
  const primaryTool = sortedTools[0];
  const detailTool = sortedTools.length > 1 ? sortedTools[sortedTools.length - 1] : null;

  const stockBounds = {
    minX: 0,
    minY: 0,
    maxX: width,
    maxY: height,
    width,
    height,
  };

  const safeVolume = new SafeVolumeManager(regions, stockBounds);
  const allOperations: ToolpathOperation[] = [];
  const processedRegionIds = new Set<string>();

  // 1. Process Dedicated Slots for all available tools (matching slot width)
  for (const tool of sortedTools) {
    const { operations: slotOps, processedRegionIds: slotRegionKeys } = generateSlotOperations(
      regions,
      tool,
      settings,
      stockBounds,
      safeVolume
    );
    allOperations.push(...slotOps);
    slotRegionKeys.forEach(k => processedRegionIds.add(k));
  }

  // 2. Process Pocket Clearing with Primary (Roughing) Tool
  const pocketOps = generatePocketOperations(
    regions,
    primaryTool,
    settings,
    stockBounds,
    safeVolume,
    processedRegionIds
  );
  allOperations.push(...pocketOps);

  // 3. Process Rest Machining with Detail Tool (if enabled and multiple tools available)
  if (settings.enableRestMachining && detailTool && detailTool.id !== primaryTool.id) {
    const restOps = generateRestMachiningOperations(
      regions,
      primaryTool,
      detailTool,
      settings,
      stockBounds,
      safeVolume
    );
    allOperations.push(...restOps);
  }

  // 4. Optimize Toolpath Sequencing and Minimize Tool Changes
  const { orderedOperations } = optimizeToolpathSequence(allOperations);

  return {
    ...project,
    operations: orderedOperations,
  };
}
