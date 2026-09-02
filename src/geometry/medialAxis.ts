import { Point, Polygon, BoundingBox } from '../types';
import {
  pt,
  dist,
  distSq,
  add,
  sub,
  scale,
  normalize,
  dot,
  cross,
  lerp,
  closestPointOnSegment,
  getBoundingBox,
} from './point';
import { polygonArea } from './polygon';

export interface SlotAnalysis {
  isSlot: boolean;
  width: number;
  length: number;
  centerline: Point[];
  openEnds: { startOpen: boolean; endOpen: boolean };
}

/**
 * Evaluates whether a given polygon is a slot/channel and extracts its centerline.
 */
export function analyzeSlot(
  poly: Polygon,
  expectedWidth: number,
  toleranceRatio = 0.15
): SlotAnalysis | null {
  const n = poly.length;
  if (n < 4) return null;

  // Approximate minimum bounding rectangle / principal axis
  const bbox = getBoundingBox(poly);
  const area = Math.abs(polygonArea(poly));

  // If it's a 4-vertex quad or simplified rectangle
  if (n === 4) {
    const e0 = dist(poly[0], poly[1]);
    const e1 = dist(poly[1], poly[2]);
    const e2 = dist(poly[2], poly[3]);
    const e3 = dist(poly[3], poly[0]);

    // Check pairs of opposing edges
    const isPair1 = Math.abs(e0 - e2) < (e0 + e2) * 0.15 && Math.abs(e1 - e3) < (e1 + e3) * 0.15;
    if (isPair1) {
      const w1 = (e0 + e2) / 2;
      const w2 = (e1 + e3) / 2;

      let slotW = Math.min(w1, w2);
      let slotL = Math.max(w1, w2);

      // Check if width is close to expected width
      const widthDiff = Math.abs(slotW - expectedWidth);
      if (widthDiff <= expectedWidth * toleranceRatio || expectedWidth === 0) {
        let pStart: Point;
        let pEnd: Point;

        if (w1 < w2) {
          // e0 and e2 are the short ends
          pStart = lerp(poly[0], poly[1], 0.5);
          pEnd = lerp(poly[2], poly[3], 0.5);
        } else {
          // e1 and e3 are the short ends
          pStart = lerp(poly[1], poly[2], 0.5);
          pEnd = lerp(poly[3], poly[0], 0.5);
        }

        return {
          isSlot: true,
          width: slotW,
          length: slotL,
          centerline: [pStart, pEnd],
          openEnds: { startOpen: true, endOpen: true },
        };
      }
    }
  }

  // General shape analysis via sampling medial chord midpoints
  if (bbox.width > bbox.height * 1.5 || bbox.height > bbox.width * 1.5) {
    const isHorizontal = bbox.width > bbox.height;
    const aspect = isHorizontal ? bbox.width / bbox.height : bbox.height / bbox.width;
    const approxW = isHorizontal ? bbox.height : bbox.width;

    if (aspect >= 1.4 && (Math.abs(approxW - expectedWidth) <= expectedWidth * (toleranceRatio + 0.1) || expectedWidth === 0)) {
      // Build centerline along principal dimension
      const steps = 10;
      const centerline: Point[] = [];

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        if (isHorizontal) {
          const x = bbox.minX + t * bbox.width;
          // Find y bounds at x
          let minYAtX = Infinity;
          let maxYAtX = -Infinity;
          for (let j = 0; j < n; j++) {
            const a = poly[j];
            const b = poly[(j + 1) % n];
            if ((a.x <= x && b.x >= x) || (b.x <= x && a.x >= x)) {
              const dx = b.x - a.x;
              if (Math.abs(dx) > 1e-6) {
                const u = (x - a.x) / dx;
                const y = a.y + u * (b.y - a.y);
                if (y < minYAtX) minYAtX = y;
                if (y > maxYAtX) maxYAtX = y;
              }
            }
          }
          if (minYAtX !== Infinity && maxYAtX !== -Infinity) {
            centerline.push(pt(x, (minYAtX + maxYAtX) / 2));
          }
        } else {
          const y = bbox.minY + t * bbox.height;
          let minXAtY = Infinity;
          let maxXAtY = -Infinity;
          for (let j = 0; j < n; j++) {
            const a = poly[j];
            const b = poly[(j + 1) % n];
            if ((a.y <= y && b.y >= y) || (b.y <= y && a.y >= y)) {
              const dy = b.y - a.y;
              if (Math.abs(dy) > 1e-6) {
                const u = (y - a.y) / dy;
                const x = a.x + u * (b.x - a.x);
                if (x < minXAtY) minXAtY = x;
                if (x > maxXAtY) maxXAtY = x;
              }
            }
          }
          if (minXAtY !== Infinity && maxXAtY !== -Infinity) {
            centerline.push(pt((minXAtY + maxXAtY) / 2, y));
          }
        }
      }

      if (centerline.length >= 2) {
        return {
          isSlot: true,
          width: approxW,
          length: Math.max(bbox.width, bbox.height),
          centerline,
          openEnds: { startOpen: true, endOpen: true },
        };
      }
    }
  }

  return null;
}

/**
 * Extends a centerline at its open start and end points into safe space by extendDist.
 */
export function extendCenterline(
  centerline: Point[],
  extendStartDist: number,
  extendEndDist: number
): Point[] {
  if (centerline.length < 2) return centerline;

  const result = [...centerline];

  if (extendStartDist > 0) {
    const p0 = centerline[0];
    const p1 = centerline[1];
    const dir = normalize(sub(p0, p1)); // pointing backwards from p0
    result[0] = add(p0, scale(dir, extendStartDist));
  }

  if (extendEndDist > 0) {
    const lastIdx = centerline.length - 1;
    const pn = centerline[lastIdx];
    const pn_1 = centerline[lastIdx - 1];
    const dir = normalize(sub(pn, pn_1)); // pointing forwards from pn
    result[lastIdx] = add(pn, scale(dir, extendEndDist));
  }

  return result;
}
