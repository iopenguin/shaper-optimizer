import { Point, BoundingBox } from '../types';

export function pt(x: number, y: number): Point {
  return { x, y };
}

export function dist(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function distSq(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function equals(a: Point, b: Point, eps = 1e-6): boolean {
  return Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps;
}

export function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(p: Point, s: number): Point {
  return { x: p.x * s, y: p.y * s };
}

export function normalize(v: Point): Point {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len < 1e-9) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function normal(v: Point): Point {
  // Left normal (-dy, dx)
  return { x: -v.y, y: v.x };
}

export function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

export function cross(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}

export function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function lineIntersection(
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point
): { point: Point; t: number; u: number } | null {
  const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (Math.abs(d) < 1e-9) return null;

  const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / d;
  const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / d;

  return {
    point: {
      x: p1.x + t * (p2.x - p1.x),
      y: p1.y + t * (p2.y - p1.y),
    },
    t,
    u,
  };
}

export function segmentIntersection(
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point
): Point | null {
  const res = lineIntersection(p1, p2, p3, p4);
  if (!res) return null;
  if (res.t >= -1e-6 && res.t <= 1 + 1e-6 && res.u >= -1e-6 && res.u <= 1 + 1e-6) {
    return res.point;
  }
  return null;
}

export function closestPointOnSegment(p: Point, a: Point, b: Point): { point: Point; t: number; dist: number } {
  const ab = sub(b, a);
  const abLenSq = distSq(a, b);
  if (abLenSq < 1e-9) {
    return { point: a, t: 0, dist: dist(p, a) };
  }
  const ap = sub(p, a);
  let t = dot(ap, ab) / abLenSq;
  t = Math.max(0, Math.min(1, t));
  const proj = add(a, scale(ab, t));
  return { point: proj, t, dist: dist(p, proj) };
}

export function getBoundingBox(points: Point[]): BoundingBox {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
