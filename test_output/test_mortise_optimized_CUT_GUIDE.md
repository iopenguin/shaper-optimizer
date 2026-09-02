# Shaper Origin Cut Guide: test_mortise.svg

### Project Overview
- **Dimensions**: 180.00 x 100.00 mm
- **Stock Thickness**: 12.70 mm
- **Total Cut Distance**: 2747.79 mm
- **Estimated Machining Time**: ~2m 24s

### Recommended Tool Sequence
#### Step 1: Install **12mm Bulk Roughing Endmill** (Ø 12 mm)
- **Cut Mode on Origin**: Select **On-Line**
- **Passes**: 3 operation(s)
  - stock_outline (12.00 mm) - Exterior Profile Pass 1/2 (-6.00) (Depth: -6.000 mm)
  - stock_outline (12.00 mm) - Exterior Profile Pass 2/2 (-12.00) (Depth: -12.000 mm)
  - center_pocket (6.00 mm) - Rectilinear Spiral Pocket Pass 1/1 (-6.00) (Depth: -6.000 mm)

#### Step 2: Install **6.35mm (1/4") Spiral Cutter** (Ø 6.35 mm)
- **Cut Mode on Origin**: Select **On-Line**
- **Passes**: 4 operation(s)
  - edge_slot_through (12.00 mm) - Slot Pass 1/4 (-3.00) (Depth: -3.000 mm)
  - edge_slot_through (12.00 mm) - Slot Pass 2/4 (-6.00) (Depth: -6.000 mm)
  - edge_slot_through (12.00 mm) - Slot Pass 3/4 (-9.00) (Depth: -9.000 mm)
  - edge_slot_through (12.00 mm) - Slot Pass 4/4 (-12.00) (Depth: -12.000 mm)

#### Step 3: Install **3.175mm (1/8") Detail Spiral** (Ø 3.175 mm)
- **Cut Mode on Origin**: Select **On-Line**
- **Passes**: 3 operation(s)
  - center_pocket (6.00 mm) - Rest Finishing (3.175mm (1/8") Detail Spiral) (Depth: -6.000 mm)
  - edge_slot_through (12.00 mm) - Rest Finishing (3.175mm (1/8") Detail Spiral) (Depth: -12.000 mm)
  - stock_outline (12.00 mm) - Rest Finishing (3.175mm (1/8") Detail Spiral) (Depth: -12.000 mm)


### Included Files
- `test_mortise_optimized_12mm_Bulk_Roughing_Endmill.svg` (12mm Bulk Roughing Endmill)
- `test_mortise_optimized_6_35mm__1_4___Spiral_Cutter.svg` (6.35mm (1/4") Spiral Cutter)
- `test_mortise_optimized_3_175mm__1_8___Detail_Spiral.svg` (3.175mm (1/8") Detail Spiral)
