export interface SampleProject {
  id: string;
  name: string;
  description: string;
  svg: string;
  units: 'mm' | 'inch';
  thickness: number;
}

export const SAMPLE_PROJECTS: SampleProject[] = [
  {
    id: 'mortise-slot-exit',
    name: 'Mortise & Tenon Edge Slot (Square Exit)',
    description: 'Demonstrates square slot exit: 1/4" slot reaches the edge of the stock. Volumetric CAM sweeps past the perimeter into air, producing sharp square exits instead of rounded fillets.',
    units: 'mm',
    thickness: 12.0,
    svg: `<?xml version="1.0" encoding="utf-8"?>
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:shaper="http://www.shapertools.com/namespaces/shaper" width="200mm" height="120mm" viewBox="0 0 200 120">
  <!-- Stock Boundary (Outline) -->
  <rect id="stock_outline" x="10" y="10" width="180" height="100" fill="#ffffff" stroke="#000000" stroke-width="0.254" shaper:pathType="exterior" shaper:cutDepth="12.0mm" />
  
  <!-- Through Mortise Slot (Exiting Left Edge) - 6.35mm / 1/4" wide -->
  <rect id="edge_slot_through" x="10" y="46.825" width="60" height="6.35" fill="#000000" stroke="#000000" stroke-width="0.254" shaper:pathType="pocket" shaper:cutDepth="12.0mm" />
  
  <!-- Shallow Dado Slot (6mm depth, intersecting right edge) -->
  <rect id="dado_slot_shallow" x="130" y="30" width="60" height="12.7" fill="#808080" stroke="#000000" stroke-width="0.254" shaper:pathType="pocket" shaper:cutDepth="6.0mm" />

  <!-- Center Pocket (6mm depth) -->
  <rect id="center_pocket" x="80" y="35" width="40" height="50" fill="#808080" stroke="#000000" stroke-width="0.254" shaper:pathType="pocket" shaper:cutDepth="6.0mm" />
</svg>`,
  },
  {
    id: 'stepped-tray',
    name: 'Multi-Depth Stepped Tray & Connecting Slots',
    description: 'Demonstrates multi-depth safe overcut: Shallow slots connecting shallow pockets to deep pockets. Tool safely crosses into deep cavity without stopping early.',
    units: 'mm',
    thickness: 15.0,
    svg: `<?xml version="1.0" encoding="utf-8"?>
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:shaper="http://www.shapertools.com/namespaces/shaper" width="220mm" height="140mm" viewBox="0 0 220 140">
  <!-- Outer stock perimeter -->
  <rect id="tray_outline" x="10" y="10" width="200" height="120" rx="10" fill="#ffffff" stroke="#000000" stroke-width="0.254" shaper:pathType="exterior" shaper:cutDepth="15.0mm" />
  
  <!-- Shallow Left Compartment (4mm deep) -->
  <rect id="shallow_left_pocket" x="25" y="25" width="60" height="90" rx="5" fill="#a0a0a0" stroke="#000000" stroke-width="0.254" shaper:pathType="pocket" shaper:cutDepth="4.0mm" />
  
  <!-- Deep Right Compartment (10mm deep) -->
  <rect id="deep_right_pocket" x="115" y="25" width="80" height="90" rx="5" fill="#404040" stroke="#000000" stroke-width="0.254" shaper:pathType="pocket" shaper:cutDepth="10.0mm" />
  
  <!-- Connecting Channel (4mm deep, exactly 6.35mm / 1/4" wide) connecting left and right compartments -->
  <rect id="connector_channel" x="85" y="66.825" width="30" height="6.35" fill="#a0a0a0" stroke="#000000" stroke-width="0.254" shaper:pathType="pocket" shaper:cutDepth="4.0mm" />
</svg>`,
  },
  {
    id: 'rest-machining-inlay',
    name: 'Dual-Bit Rest Machining (Rough 1/4" + Detail 1/16")',
    description: 'Demonstrates multi-bit optimization: 1/4" bit clears 90% of bulk pocket volume, and 1/16" bit only cuts tight inside sharp corners and fine details.',
    units: 'mm',
    thickness: 8.0,
    svg: `<?xml version="1.0" encoding="utf-8"?>
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:shaper="http://www.shapertools.com/namespaces/shaper" width="180mm" height="120mm" viewBox="0 0 180 120">
  <rect id="plaque_boundary" x="10" y="10" width="160" height="100" fill="#ffffff" stroke="#000000" stroke-width="0.254" shaper:pathType="exterior" shaper:cutDepth="8.0mm" />
  
  <!-- Main pocket with sharp star/cross internal corners -->
  <polygon id="star_pocket" points="90,20 105,45 135,45 110,65 120,95 90,75 60,95 70,65 45,45 75,45" fill="#606060" stroke="#000000" stroke-width="0.254" shaper:pathType="pocket" shaper:cutDepth="4.0mm" />
</svg>`,
  },
  {
    id: 't-track-keyway',
    name: 'T-Track Keyway Slider (Single-Pass Centerline)',
    description: 'Demonstrates exact bit-width slot routing with multi-depth stepdown passes.',
    units: 'inch',
    thickness: 0.75,
    svg: `<?xml version="1.0" encoding="utf-8"?>
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:shaper="http://www.shapertools.com/namespaces/shaper" width="8in" height="5in" viewBox="0 0 8 5">
  <rect id="board" x="0.5" y="0.5" width="7" height="4" fill="#ffffff" stroke="#000000" stroke-width="0.010in" shaper:pathType="exterior" shaper:cutDepth="0.75in" />
  
  <!-- 1/4" Straight Slot along X axis (through cut) -->
  <rect id="slot_1_4" x="0.5" y="1.875" width="7" height="0.25" fill="#000000" stroke="#000000" stroke-width="0.010in" shaper:pathType="pocket" shaper:cutDepth="0.50in" />

  <!-- 1/8" Fine Keyway Slot along Y axis -->
  <rect id="slot_1_8" x="4.4375" y="0.5" width="0.125" height="4" fill="#404040" stroke="#000000" stroke-width="0.010in" shaper:pathType="pocket" shaper:cutDepth="0.25in" />
</svg>`,
  },
];
