import { DepthRegion, Polygon, PolygonWithHoles, UnitType, BoundingBox, Point } from '../types';
import { pt, getBoundingBox } from '../geometry/point';
import { polygonArea, ensureOrientation } from '../geometry/polygon';

export interface ParsedSVGResult {
  fileName: string;
  units: UnitType;
  width: number;
  height: number;
  totalThickness: number;
  regions: DepthRegion[];
  stockBounds: BoundingBox;
}

interface RawElement {
  tagName: string;
  attributes: Record<string, string>;
}

export function parseSVG(
  svgString: string,
  fileName = 'design.svg',
  defaultThickness = 12.7 // 1/2 in or 12.7 mm
): ParsedSVGResult {
  const elements = extractSvgElements(svgString);

  // Detect SVG Root attributes
  let units: UnitType = 'mm';
  const rootEl = elements.find(e => e.tagName === 'svg');
  const widthAttr = rootEl?.attributes['width'] || '';
  const heightAttr = rootEl?.attributes['height'] || '';
  const viewBoxAttr = rootEl?.attributes['viewbox'] || rootEl?.attributes['viewBox'] || '';

  if (widthAttr.includes('in') || heightAttr.includes('in') || svgString.includes('0.010in')) {
    units = 'inch';
  }

  let width = parseFloat(widthAttr) || 200;
  let height = parseFloat(heightAttr) || 120;

  if (viewBoxAttr) {
    const parts = viewBoxAttr.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4) {
      if (!parseFloat(widthAttr)) width = parts[2];
      if (!parseFloat(heightAttr)) height = parts[3];
    }
  }

  const rawRegions: { region: DepthRegion; isExterior: boolean }[] = [];
  const allPoints: Point[] = [];
  let elementIndex = 0;

  for (const el of elements) {
    if (el.tagName === 'svg' || el.tagName === 'g') continue;

    elementIndex++;
    const depthAttr =
      el.attributes['shaper:cutdepth'] ||
      el.attributes['shaper:cutDepth'] ||
      el.attributes['cutdepth'] ||
      el.attributes['cutDepth'] ||
      el.attributes['data-depth'] ||
      el.attributes['id'] ||
      '';

    const pathTypeAttr =
      el.attributes['shaper:pathtype'] ||
      el.attributes['shaper:pathType'] ||
      el.attributes['pathtype'] ||
      el.attributes['pathType'] ||
      'pocket';

    const fillAttr = el.attributes['fill'] || '';
    const strokeAttr = el.attributes['stroke'] || '';
    const idAttr = el.attributes['id'] || `region_${elementIndex}`;

    // Compute numeric depth
    const depth = extractDepthValue(depthAttr, fillAttr, defaultThickness, units);

    // Parse shape geometry into polygon
    const polygon = parseElementToPolygon(el);
    if (!polygon || polygon.length < 3) continue;

    allPoints.push(...polygon);

    const orientedOuter = ensureOrientation(polygon, true);
    const isExterior = pathTypeAttr === 'exterior' || idAttr.toLowerCase().includes('stock') || idAttr.toLowerCase().includes('outline');

    const region: DepthRegion = {
      id: `region_${elementIndex}_${idAttr}`,
      name: `${idAttr} (${depth.toFixed(2)} ${units})`,
      depth,
      sourceType: isExterior ? 'exterior' : (pathTypeAttr as any) || 'pocket',
      rawColor: fillAttr || strokeAttr || '#3b82f6',
      polygons: [
        {
          outer: orientedOuter,
          holes: [],
        },
      ],
    };

    rawRegions.push({ region, isExterior });
  }

  // Calculate raw stock bounding box
  const rawBounds = getBoundingBox(allPoints.length > 0 ? allPoints : [pt(0, 0), pt(width, height)]);

  // Check if coordinates have an offset origin (e.g. minX > 0 or minY > 0)
  const shiftX = rawBounds.minX;
  const shiftY = rawBounds.minY;

  // Normalize all regions so origin is (0, 0)
  const regions: DepthRegion[] = rawRegions.map(({ region }) => ({
    ...region,
    polygons: region.polygons.map(p => ({
      outer: p.outer.map(pt => ({ x: pt.x - shiftX, y: pt.y - shiftY })),
      holes: p.holes.map(h => h.map(pt => ({ x: pt.x - shiftX, y: pt.y - shiftY }))),
    })),
  }));

  const normalizedW = rawBounds.width > 0 ? rawBounds.width : width;
  const normalizedH = rawBounds.height > 0 ? rawBounds.height : height;

  const stockBounds: BoundingBox = {
    minX: 0,
    minY: 0,
    maxX: normalizedW,
    maxY: normalizedH,
    width: normalizedW,
    height: normalizedH,
  };

  return {
    fileName,
    units,
    width: normalizedW,
    height: normalizedH,
    totalThickness: defaultThickness,
    regions,
    stockBounds,
  };
}

function extractSvgElements(svgString: string): RawElement[] {
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgString, 'image/svg+xml');
      const nodes = doc.querySelectorAll('svg, path, rect, circle, ellipse, polygon, polyline');
      const results: RawElement[] = [];

      nodes.forEach(node => {
        const attrs: Record<string, string> = {};
        for (let i = 0; i < node.attributes.length; i++) {
          const attr = node.attributes[i];
          attrs[attr.name] = attr.value;
          attrs[attr.name.toLowerCase()] = attr.value;
        }
        results.push({
          tagName: node.tagName.toLowerCase(),
          attributes: attrs,
        });
      });
      return results;
    } catch {
      // fallback to regex
    }
  }

  // Regex-based universal XML extractor for Node.js
  const results: RawElement[] = [];
  const tagRegex = /<([a-zA-Z0-9:]+)([^>]*?)(\/?>)/g;
  let match;

  while ((match = tagRegex.exec(svgString)) !== null) {
    const tagName = match[1].toLowerCase().replace(/^.*:/, '');
    const attrString = match[2];
    const attrs: Record<string, string> = {};

    const attrRegex = /([a-zA-Z0-9:_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^>\s]+))/g;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(attrString)) !== null) {
      const name = attrMatch[1];
      const val = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '';
      attrs[name] = val;
      attrs[name.toLowerCase()] = val;
    }

    results.push({
      tagName,
      attributes: attrs,
    });
  }

  return results;
}

function extractDepthValue(
  depthStr: string,
  fillColor: string,
  totalThickness: number,
  units: UnitType
): number {
  if (depthStr) {
    const match = depthStr.match(/([0-9.]+)\s*(in|mm|inch)?/i);
    if (match) {
      const val = parseFloat(match[1]);
      const unit = match[2]?.toLowerCase();
      if (unit === 'in' || unit === 'inch') {
        return units === 'mm' ? val * 25.4 : val;
      } else if (unit === 'mm') {
        return units === 'inch' ? val / 25.4 : val;
      }
      return val;
    }
  }

  // Check grayscale fill
  if (fillColor && fillColor !== 'none') {
    const rgb = parseColorToRgb(fillColor);
    if (rgb) {
      const brightness = (rgb.r + rgb.g + rgb.b) / (3 * 255);
      const depthFraction = 1.0 - brightness;
      if (depthFraction > 0.05) {
        return depthFraction * totalThickness;
      }
    }
  }

  return totalThickness * 0.5;
}

function parseColorToRgb(color: string): { r: number; g: number; b: number } | null {
  color = color.trim();
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
      };
    }
    if (hex.length === 6) {
      return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16),
      };
    }
  }
  const rgbMatch = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
    };
  }
  return null;
}

function parseElementToPolygon(el: RawElement): Polygon | null {
  const tagName = el.tagName.toLowerCase();

  if (tagName === 'rect') {
    const x = parseFloat(el.attributes['x'] || '0');
    const y = parseFloat(el.attributes['y'] || '0');
    const w = parseFloat(el.attributes['width'] || '0');
    const h = parseFloat(el.attributes['height'] || '0');
    if (w <= 0 || h <= 0) return null;
    return [pt(x, y), pt(x + w, y), pt(x + w, y + h), pt(x, y + h)];
  }

  if (tagName === 'circle') {
    const cx = parseFloat(el.attributes['cx'] || '0');
    const cy = parseFloat(el.attributes['cy'] || '0');
    const r = parseFloat(el.attributes['r'] || '0');
    if (r <= 0) return null;
    const segs = 36;
    const points: Point[] = [];
    for (let i = 0; i < segs; i++) {
      const angle = (i / segs) * Math.PI * 2;
      points.push(pt(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r));
    }
    return points;
  }

  if (tagName === 'polygon' || tagName === 'polyline') {
    const ptsAttr = el.attributes['points'] || '';
    const coords = ptsAttr.trim().split(/[\s,]+/).map(Number);
    const points: Point[] = [];
    for (let i = 0; i < coords.length - 1; i += 2) {
      points.push(pt(coords[i], coords[i + 1]));
    }
    return points.length >= 3 ? points : null;
  }

  if (tagName === 'path') {
    const d = el.attributes['d'] || '';
    return parsePathD(d);
  }

  return null;
}

function parsePathD(d: string): Polygon | null {
  if (!d) return null;

  const commands = d.match(/([a-df-z])|([-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?)/gi);
  if (!commands) return null;

  const points: Point[] = [];
  let curX = 0;
  let curY = 0;
  let startX = 0;
  let startY = 0;
  let cmd = '';

  let i = 0;
  while (i < commands.length) {
    const token = commands[i];
    if (/^[a-df-z]$/i.test(token)) {
      cmd = token;
      i++;
    }

    if (cmd === 'M') {
      curX = parseFloat(commands[i++]);
      curY = parseFloat(commands[i++]);
      startX = curX;
      startY = curY;
      points.push(pt(curX, curY));
      cmd = 'L';
    } else if (cmd === 'm') {
      curX += parseFloat(commands[i++]);
      curY += parseFloat(commands[i++]);
      startX = curX;
      startY = curY;
      points.push(pt(curX, curY));
      cmd = 'l';
    } else if (cmd === 'L') {
      curX = parseFloat(commands[i++]);
      curY = parseFloat(commands[i++]);
      points.push(pt(curX, curY));
    } else if (cmd === 'l') {
      curX += parseFloat(commands[i++]);
      curY += parseFloat(commands[i++]);
      points.push(pt(curX, curY));
    } else if (cmd === 'H') {
      curX = parseFloat(commands[i++]);
      points.push(pt(curX, curY));
    } else if (cmd === 'h') {
      curX += parseFloat(commands[i++]);
      points.push(pt(curX, curY));
    } else if (cmd === 'V') {
      curY = parseFloat(commands[i++]);
      points.push(pt(curX, curY));
    } else if (cmd === 'v') {
      curY += parseFloat(commands[i++]);
      points.push(pt(curX, curY));
    } else if (cmd === 'C') {
      const x1 = parseFloat(commands[i++]);
      const y1 = parseFloat(commands[i++]);
      const x2 = parseFloat(commands[i++]);
      const y2 = parseFloat(commands[i++]);
      const x = parseFloat(commands[i++]);
      const y = parseFloat(commands[i++]);
      const steps = 8;
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const bx = Math.pow(1 - t, 3) * curX + 3 * Math.pow(1 - t, 2) * t * x1 + 3 * (1 - t) * t * t * x2 + Math.pow(t, 3) * x;
        const by = Math.pow(1 - t, 3) * curY + 3 * Math.pow(1 - t, 2) * t * y1 + 3 * (1 - t) * t * t * y2 + Math.pow(t, 3) * y;
        points.push(pt(bx, by));
      }
      curX = x;
      curY = y;
    } else if (cmd === 'c') {
      const x1 = curX + parseFloat(commands[i++]);
      const y1 = curY + parseFloat(commands[i++]);
      const x2 = curX + parseFloat(commands[i++]);
      const y2 = curY + parseFloat(commands[i++]);
      const x = curX + parseFloat(commands[i++]);
      const y = curY + parseFloat(commands[i++]);
      const steps = 8;
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const bx = Math.pow(1 - t, 3) * curX + 3 * Math.pow(1 - t, 2) * t * x1 + 3 * (1 - t) * t * t * x2 + Math.pow(t, 3) * x;
        const by = Math.pow(1 - t, 3) * curY + 3 * Math.pow(1 - t, 2) * t * y1 + 3 * (1 - t) * t * t * y2 + Math.pow(t, 3) * y;
        points.push(pt(bx, by));
      }
      curX = x;
      curY = y;
    } else if (cmd === 'Z' || cmd === 'z') {
      points.push(pt(startX, startY));
      curX = startX;
      curY = startY;
      break;
    } else {
      i++;
    }
  }

  return points.length >= 3 ? points : null;
}
