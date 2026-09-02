import { Point, Polygon, PolygonWithHoles, BoundingBox } from '../types';
import {
  pt,
  dist,
  distSq,
  add,
  sub,
  scale,
  normalize,
  normal,
  dot,
  cross,
  lineIntersection,
  segmentIntersection,
  closestPointOnSegment,
  getBoundingBox,
  equals,
  lerp,
} from './point';

export function polygonArea(poly: Polygon): number {
  const n = poly.length;
  if (n < 3) return 0;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += poly[i].x * poly[j].y;
    area -= poly[j].x * poly[i].y;
  }
  return area / 2;
}

export function isClockwise(poly: Polygon): boolean {
  return polygonArea(poly) < 0;
}

export function ensureOrientation(poly: Polygon, ccw: boolean): Polygon {
  const area = polygonArea(poly);
  if ((ccw && area < 0) || (!ccw && area > 0)) {
    return [...poly].reverse();
  }
  return [...poly];
}

export function isPointInPolygon(p: Point, poly: Polygon): boolean {
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > p.y) !== (yj > p.y)) &&
      (p.x < ((xj - xi) * (p.y - yi)) / (yj - yi + 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function isPointInPolygonWithHoles(p: Point, shape: PolygonWithHoles): boolean {
  if (!isPointInPolygon(p, shape.outer)) return false;
  for (const hole of shape.holes) {
    if (isPointInPolygon(p, hole)) return false;
  }
  return true;
}

export function distanceToPolygon(p: Point, poly: Polygon): { dist: number; closestPoint: Point; isInside: boolean } {
  let minDist = Infinity;
  let closest: Point = poly[0] || p;
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const cp = closestPointOnSegment(p, a, b);
    if (cp.dist < minDist) {
      minDist = cp.dist;
      closest = cp.point;
    }
  }
  const inside = isPointInPolygon(p, poly);
  return { dist: minDist, closestPoint: closest, isInside: inside };
}

export function simplifyPolygon(poly: Polygon, tolerance: number): Polygon {
  if (poly.length <= 3) return poly;
  return ramerDouglasPeucker(poly, tolerance);
}

export function ramerDouglasPeucker(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let index = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const cp = closestPointOnSegment(points[i], first, last);
    if (cp.dist > maxDist) {
      maxDist = cp.dist;
      index = i;
    }
  }

  if (maxDist > tolerance) {
    const recResults1 = ramerDouglasPeucker(points.slice(0, index + 1), tolerance);
    const recResults2 = ramerDouglasPeucker(points.slice(index), tolerance);
    return recResults1.slice(0, recResults1.length - 1).concat(recResults2);
  } else {
    return [first, last];
  }
}

/**
 * Offsets a simple closed polygon by a given distance.
 * Positive delta = inset inwards (shrinking, for pocketing/interior).
 * Negative delta = expand outwards (dilation, for exterior profiling).
 */
export function offsetPolygon(
  poly: Polygon,
  delta: number,
  joinType: 'round' | 'miter' | 'square' = 'round'
): Polygon[] {
  const n = poly.length;
  if (n < 3 || Math.abs(delta) < 1e-5) return [poly];

  const origArea = polygonArea(poly);
  // Ensure poly is standard CCW orientation
  const isCCW = origArea > 0;
  const oriented = isCCW ? poly : [...poly].reverse();

  // Edge vectors and inward/outward normals
  const edges: { a: Point; b: Point; v: Point; nIn: Point; len: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = oriented[i];
    const b = oriented[(i + 1) % n];
    const v = sub(b, a);
    const len = Math.sqrt(v.x * v.x + v.y * v.y);
    if (len < 1e-6) continue;
    const uv = scale(v, 1 / len);

    // In a CCW polygon in standard 2D, left normal (-dy, dx) points inward.
    // Let's verify by testing midpoint shifted inward
    let candidateIn = normal(uv);
    const mid = lerp(a, b, 0.5);
    const probe = add(mid, scale(candidateIn, 0.05));
    if (!isPointInPolygon(probe, oriented)) {
      candidateIn = scale(candidateIn, -1);
    }

    edges.push({ a, b, v: uv, nIn: candidateIn, len });
  }

  const numEdges = edges.length;
  if (numEdges < 3) return [];

  // Shift edges along inward normal: +delta moves inward, -delta moves outward
  const offsetSegments: { a: Point; b: Point }[] = [];
  for (let i = 0; i < numEdges; i++) {
    const e = edges[i];
    const shift = scale(e.nIn, delta);
    offsetSegments.push({
      a: add(e.a, shift),
      b: add(e.b, shift),
    });
  }

  // Intersect consecutive offset segments
  const rawPoints: Point[] = [];
  for (let i = 0; i < numEdges; i++) {
    const prevIdx = (i - 1 + numEdges) % numEdges;
    const sPrev = offsetSegments[prevIdx];
    const sCurr = offsetSegments[i];

    const inter = lineIntersection(sPrev.a, sPrev.b, sCurr.a, sCurr.b);
    if (inter) {
      const miterDist = dist(inter.point, oriented[i]);
      if (miterDist < Math.abs(delta) * 2.5 || joinType === 'miter') {
        rawPoints.push(inter.point);
      } else {
        rawPoints.push(sPrev.b);
        rawPoints.push(sCurr.a);
      }
    } else {
      rawPoints.push(sPrev.b);
      rawPoints.push(sCurr.a);
    }
  }

  // If insetting (+delta), verify that offset points are inside and area has decreased
  if (delta > 0) {
    const newArea = polygonArea(rawPoints);
    if (newArea <= 0 || newArea >= Math.abs(origArea)) {
      // Offset collapsed or inverted
      return [];
    }

    // Filter points to ensure they stay inside or close to original boundary
    const validInside = rawPoints.filter(p => isPointInPolygon(p, oriented));
    if (validInside.length < 3) {
      return [];
    }
  }

  const cleaned = cleanSelfIntersections(rawPoints, delta > 0);
  return cleaned.filter(p => Math.abs(polygonArea(p)) > Math.abs(delta) * Math.abs(delta) * 0.1);
}

export function cleanSelfIntersections(poly: Polygon, isInset: boolean): Polygon[] {
  if (poly.length < 3) return [];

  // Remove duplicate adjacent points
  const dedup: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const next = poly[(i + 1) % poly.length];
    if (distSq(p, next) > 1e-8) {
      dedup.push(p);
    }
  }

  if (dedup.length < 3) return [];

  // Break poly at self intersections if any
  const n = dedup.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const p1 = dedup[i];
      const p2 = dedup[(i + 1) % n];
      const p3 = dedup[j];
      const p4 = dedup[(j + 1) % n];
      const inter = segmentIntersection(p1, p2, p3, p4);
      if (inter && distSq(inter, p1) > 1e-6 && distSq(inter, p2) > 1e-6) {
        // Split into two sub-loops
        const loop1 = [inter, ...dedup.slice(i + 1, j + 1)];
        const loop2 = [inter, ...dedup.slice(j + 1), ...dedup.slice(0, i + 1)];
        
        const area1 = polygonArea(loop1);
        const area2 = polygonArea(loop2);

        const validLoops: Polygon[] = [];
        if (Math.abs(area1) > 1e-4) validLoops.push(...cleanSelfIntersections(loop1, isInset));
        if (Math.abs(area2) > 1e-4) validLoops.push(...cleanSelfIntersections(loop2, isInset));
        return validLoops;
      }
    }
  }

  return [dedup];
}

export function samplePolygonPoints(poly: Polygon, spacing: number): Point[] {
  const pts: Point[] = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const d = dist(a, b);
    pts.push(a);
    if (d > spacing) {
      const steps = Math.floor(d / spacing);
      for (let s = 1; s < steps; s++) {
        pts.push(lerp(a, b, s / steps));
      }
    }
  }
  return pts;
}
