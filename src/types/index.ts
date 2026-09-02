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

export type CutterSectionType = 'straight' | 'angled' | 'outside-arc' | 'inside-arc';

export interface CutterSection {
  id: string;
  type: CutterSectionType;
  diameter: number; // Major / starting diameter of this section
  endDiameter?: number; // For angled/tapered sections (defaults to diameter if not set)
  height: number; // Length along the Z-axis of this section
  taperAngle?: number; // In degrees, positive = tapering down to smaller dia, negative = expanding down
  radius?: number; // For outside-arc (fillet/roundover) or inside-arc (cove)
}

export type ToolCategory =
  | 'endmill'
  | 'v-bit'
  | 'ball-nose'
  | 'profile'
  | 'surfacing'
  | 'dovetail'
  | 'specialty';

export interface ToolDefinition {
  id: string;
  name: string;
  diameter: number; // in mm or inches depending on project unit (max effective cut diameter)
  colletDiameter?: number; // Shank / collet diameter (e.g. 0.25", 0.125", 8mm)
  fluteLength: number;
  maxStepDown: number;
  stepOverRatio: number; // 0.1 to 0.9 (e.g. 0.65 = 65%)
  feedRate: number; // mm/min or in/min
  plungeRate: number;
  color: string;
  description?: string;
  enabled?: boolean;
  category?: ToolCategory;
  sku?: string;
  sections: CutterSection[]; // Stack of cutter sections from collet down to tip
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

export type OperationType =
  | 'pocket-clear'
  | 'slot-single-pass'
  | 'centerline-slot'
  | 'profile-contour'
  | 'rest-finishing'
  | 'corner-cleanout';

export interface ToolpathOperation {
  id: string;
  name: string;
  toolId: string;
  tool: ToolDefinition;
  targetDepth: number;
  passIndex: number;
  totalPasses: number;
  currentPassDepth: number;
  type: OperationType;
  segments: ToolpathSegment[];
  estimatedLength: number;
  estimatedTimeSec: number;
  visible: boolean;
  color: string;
}

export interface CAMSettings {
  slotDetectionTolerance: number;
  safeOvertravelMargin: number;
  stepOverRatio: number;
  climbMilling: boolean;
  enableRestMachining: boolean;
  cornerStrategy: 'square-overcut' | 'fillet' | 'dogbone' | 't-bone';
  leadInRadius: number;
  simplifyTolerance: number;
}

export type ExportFormat = 'single' | 'multiple' | 'both';
export type UnitType = 'mm' | 'inch';

export interface ExportSettings {
  format: ExportFormat;
  includeGuideLayers: boolean;
  colorCodeByBit: boolean;
  strokeWidth: number;
  includeShaperMetadata: boolean;
  units: UnitType;
  prefix?: string;
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
