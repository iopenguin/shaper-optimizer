#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// Load compiled or pure JS modules
import { parseSVG } from '../src/parser/svgParser.ts';
import { runCAMPipeline } from '../src/cam/pipeline.ts';
import { getDefaultTools } from '../src/data/defaultTools.ts';
import { exportToolpathSVGs } from '../src/exporter/svgExporter.ts';

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(`
Shaper Origin Toolpath Generator & Optimizer (CLI)
==================================================

Usage:
  shaper-optimizer <input-svg-file> [options]

Options:
  -o, --out <dir>          Output directory (default: current directory)
  -f, --format <format>    Export format: 'both', 'single', 'multiple' (default: 'both')
  -u, --units <unit>       Units: 'mm' or 'inch' (default: auto-detected from SVG)
  -t, --thickness <num>    Total stock thickness (default: 12.7mm or 0.5in)
  -p, --prefix <name>      File prefix for output files (default: 'optimized')
  -h, --help               Show this help message

Example:
  node bin/shaper-optimizer.mjs sample.svg --format both --out ./output
`);
  process.exit(0);
}

const inputPath = args[0];
if (!fs.existsSync(inputPath)) {
  console.error(`Error: Input file '${inputPath}' does not exist.`);
  process.exit(1);
}

let outDir = process.cwd();
let format = 'both';
let units = undefined;
let thickness = 12.7;
let prefix = 'optimized';

for (let i = 1; i < args.length; i++) {
  if (args[i] === '-o' || args[i] === '--out') {
    outDir = args[++i];
  } else if (args[i] === '-f' || args[i] === '--format') {
    format = args[++i];
  } else if (args[i] === '-u' || args[i] === '--units') {
    units = args[++i];
  } else if (args[i] === '-t' || args[i] === '--thickness') {
    thickness = parseFloat(args[++i]);
  } else if (args[i] === '-p' || args[i] === '--prefix') {
    prefix = args[++i];
  }
}

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

console.log(`Processing '${inputPath}'...`);
const svgContent = fs.readFileSync(inputPath, 'utf8');
const fileName = path.basename(inputPath);

const parsed = parseSVG(svgContent, fileName, thickness);
const targetUnits = units || parsed.units;
const tools = getDefaultTools(targetUnits);

const project = {
  fileName,
  units: targetUnits,
  width: parsed.width,
  height: parsed.height,
  totalThickness: thickness,
  regions: parsed.regions,
  tools,
  operations: [],
  settings: {
    slotDetectionTolerance: 0.15,
    safeOvertravelMargin: 1.0,
    stepOverRatio: 0.65,
    climbMilling: true,
    enableRestMachining: true,
    cornerStrategy: 'square-overcut',
    leadInRadius: 0,
    simplifyTolerance: 0.05,
  },
  exportSettings: {
    format,
    includeGuideLayers: true,
    colorCodeByBit: true,
    strokeWidth: targetUnits === 'inch' ? 0.01 : 0.254,
    includeShaperMetadata: true,
    units: targetUnits,
    prefix,
  },
};

const optimized = runCAMPipeline(project);
console.log(`Generated ${optimized.operations.length} toolpath operations.`);

const result = await exportToolpathSVGs(optimized);

const baseName = (fileName.replace(/\.svg$/i, '') || 'shaper_project') + '_' + prefix;

if (format === 'single' || format === 'both') {
  if (result.combinedSvg) {
    const p = path.join(outDir, `${baseName}_combined.svg`);
    fs.writeFileSync(p, result.combinedSvg);
    console.log(`  ✓ Saved: ${p}`);
  }
}

if (format === 'multiple' || format === 'both') {
  if (result.filesByTool) {
    for (const f of result.filesByTool) {
      const p = path.join(outDir, f.fileName);
      fs.writeFileSync(p, f.content);
      console.log(`  ✓ Saved: ${p}`);
    }
  }
}

const guidePath = path.join(outDir, `${baseName}_CUT_GUIDE.md`);
fs.writeFileSync(guidePath, result.jobSheet);
console.log(`  ✓ Saved: ${guidePath}`);

console.log('\nAll files exported successfully for Shaper Origin On-Line mode!');
