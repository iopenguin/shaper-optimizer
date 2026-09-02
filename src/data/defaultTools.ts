import { ToolDefinition, UnitType } from '../types';

export function getDefaultTools(unit: UnitType): ToolDefinition[] {
  if (unit === 'inch') {
    return [
      {
        id: 'tool_1_2_rough',
        name: '1/2" Bulk Roughing Endmill',
        diameter: 0.5,
        fluteLength: 1.0,
        maxStepDown: 0.25,
        stepOverRatio: 0.65,
        feedRate: 60, // in/min
        plungeRate: 20,
        color: '#ef4444', // Red
        description: 'Large diameter bit for rapid bulk material clearing',
        enabled: true,
      },
      {
        id: 'tool_1_4_standard',
        name: '1/4" Spiral Upcut (Standard)',
        diameter: 0.25,
        fluteLength: 0.75,
        maxStepDown: 0.125,
        stepOverRatio: 0.65,
        feedRate: 45, // in/min
        plungeRate: 15,
        color: '#3b82f6', // Blue
        description: 'Standard Shaper Origin cutter for slots, pockets, and outlines',
        enabled: true,
      },
      {
        id: 'tool_1_8_detail',
        name: '1/8" Precision Spiral Downcut',
        diameter: 0.125,
        fluteLength: 0.5,
        maxStepDown: 0.0625,
        stepOverRatio: 0.6,
        feedRate: 30, // in/min
        plungeRate: 10,
        color: '#10b981', // Green
        description: 'Detail bit for tight corners, narrow slots, and clean top edges',
        enabled: true,
      },
      {
        id: 'tool_1_16_micro',
        name: '1/16" Micro Inlay Bit',
        diameter: 0.0625,
        fluteLength: 0.25,
        maxStepDown: 0.03125,
        stepOverRatio: 0.5,
        feedRate: 18, // in/min
        plungeRate: 6,
        color: '#a855f7', // Purple
        description: 'Ultra-fine bit for rest-machining sharp internal corners',
        enabled: false,
      },
    ];
  }

  // Metric default tools (mm)
  return [
    {
      id: 'tool_12mm_rough',
      name: '12mm Bulk Roughing Endmill',
      diameter: 12.0,
      fluteLength: 25.0,
      maxStepDown: 6.0,
      stepOverRatio: 0.65,
      feedRate: 1500, // mm/min
      plungeRate: 500,
      color: '#ef4444',
      description: 'Large diameter bit for rapid bulk pocket clearing',
      enabled: true,
    },
    {
      id: 'tool_6_35mm_standard',
      name: '6.35mm (1/4") Spiral Cutter',
      diameter: 6.35,
      fluteLength: 19.0,
      maxStepDown: 3.2,
      stepOverRatio: 0.65,
      feedRate: 1200,
      plungeRate: 400,
      color: '#3b82f6',
      description: 'Standard Shaper Origin router bit for general milling',
      enabled: true,
    },
    {
      id: 'tool_3_175mm_detail',
      name: '3.175mm (1/8") Detail Spiral',
      diameter: 3.175,
      fluteLength: 12.0,
      maxStepDown: 1.6,
      stepOverRatio: 0.6,
      feedRate: 800,
      plungeRate: 250,
      color: '#10b981',
      description: 'Precision bit for narrow channels and inside corner finishing',
      enabled: true,
    },
    {
      id: 'tool_1_588mm_micro',
      name: '1.588mm (1/16") Micro Bit',
      diameter: 1.588,
      fluteLength: 6.0,
      maxStepDown: 0.8,
      stepOverRatio: 0.5,
      feedRate: 450,
      plungeRate: 150,
      color: '#a855f7',
      description: 'Ultra-fine bit for rest-machining sharp internal corners',
      enabled: false,
    },
  ];
}
