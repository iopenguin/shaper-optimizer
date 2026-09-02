export interface Point {
  x: number;
  y: number;
}

export type Polygon = Point[]; // Closed ring: vertices in order (CCW = outer, CW = hole)

export interface PolygonWithHoles {
  outer: Polygon;
  holes: Polygon[];
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface ToolDefinition {
  id: string;
  name: string;
  diameter: number; // in mm or inches depending on project unit
  fluteLength: number;
  maxStepDown: number;
  stepOverRatio: number; // 0.1 to 0.9 (e.g. 0.6 = 60%)
  feedRate: number; // mm/min or in/min
  plungeRate: number;
  color: string;
  description?: string;
  enabled?: boolean;
}

export type PathType = 'pocket' | 'interior' | 'exterior' | 'slot' | 'online' | 'guide';

export interface DepthRegion {
  id: string;
  name: string;
  depth: number; // positive cut depth from top surface (0 = top/uncut, >0 = cut)
  sourceType: PathType;
  rawColor: string;
  polygons: PolygonWithHoles[];
  isStockBoundary?: boolean;
}

export type ToolpathSegmentType = 'rapid' | 'cut' | 'lead-in' | 'lead-out' | 'overtravel';

export interface ToolpathPoint extends Point {
  z: number;
  type?: ToolpathSegmentType;
}

export interface ToolpathSegment {
  type: ToolpathSegmentType;
  points: ToolpathPoint[];
  feedRate?: number;
}

export interface ToolpathOperation {
  id: string;
  name: string;
  toolId: string;
  tool: ToolDefinition;
  targetDepth: number;
  passIndex: number;
  totalPasses: number;
  currentPassDepth: number;
  type: 'centerline-slot' | 'pocket-clear' | 'profile-contour' | 'rest-finishing' | 'corner-cleanout';
  segments: ToolpathSegment[];
  estimatedLength: number; // total cut distance in units
  estimatedTimeSec: number;
  visible: boolean;
  color: string;
}

export type UnitType = 'mm' | 'inch';

export type ExportFormat = 'both' | 'single' | 'multiple';

export interface ExportSettings {
  format: ExportFormat;
  includeGuideLayers: boolean;
  colorCodeByBit: boolean;
  strokeWidth: number; // in units (default 0.010 in = 0.254 mm)
  includeShaperMetadata: boolean;
  units: UnitType;
  prefix: string;
}

export interface CAMSettings {
  slotDetectionTolerance: number; // tolerance to classify channel as exact bit width (e.g. 0.05 * tool diameter)
  safeOvertravelMargin: number; // extra distance past boundary into safe air/depth (e.g. 1.0 * tool radius)
  stepOverRatio: number; // default 0.65 (65%)
  climbMilling: boolean;
  enableRestMachining: boolean;
  cornerStrategy: 'square-overcut' | 'dogbone' | 't-bone' | 'standard';
  leadInRadius: number;
  simplifyTolerance: number;
}

export interface CAMProject {
  fileName: string;
  units: UnitType;
  width: number;
  height: number;
  totalThickness: number;
  regions: DepthRegion[];
  tools: ToolDefinition[];
  operations: ToolpathOperation[];
  settings: CAMSettings;
  exportSettings: ExportSettings;
}
