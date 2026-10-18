import { Point2D, PlacementZone, PlacedMapToken } from '../types/customDoc';

/**
 * Standard Ramer-Douglas-Peucker (RDP) algorithm to simplify a polyline / polygon.
 * Points are in relative 0-1 coordinates.
 */
export function ramerDouglasPeucker(points: Point2D[], epsilon: number): Point2D[] {
  if (points.length <= 2) return points;

  // Find the point with the maximum distance from line between first and last
  let maxDist = 0;
  let index = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], start, end);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }

  if (maxDist > epsilon) {
    const left = ramerDouglasPeucker(points.slice(0, index + 1), epsilon);
    const right = ramerDouglasPeucker(points.slice(index), epsilon);
    return left.slice(0, left.length - 1).concat(right);
  } else {
    return [start, end];
  }
}

function perpendicularDistance(p: Point2D, lineStart: Point2D, lineEnd: Point2D): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const mag = Math.hypot(dx, dy);
  if (mag === 0) return Math.hypot(p.x - lineStart.x, p.y - lineStart.y);
  return Math.abs(dy * p.x - dx * p.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x) / mag;
}

/**
 * Computes polygon centroid (center of mass) using the standard polygon area formula.
 * Fallback to arithmetic mean of vertices if area is near 0.
 */
export function computePolygonCentroid(points: Point2D[]): Point2D {
  if (!points || points.length === 0) return { x: 0.5, y: 0.5 };
  if (points.length === 1) return { ...points[0] };
  if (points.length === 2) {
    return {
      x: (points[0].x + points[1].x) / 2,
      y: (points[0].y + points[1].y) / 2
    };
  }

  let signedArea = 0;
  let cx = 0;
  let cy = 0;

  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    const cross = p1.x * p2.y - p2.x * p1.y;
    signedArea += cross;
    cx += (p1.x + p2.x) * cross;
    cy += (p1.y + p2.y) * cross;
  }

  signedArea *= 0.5;
  if (Math.abs(signedArea) < 1e-6) {
    // Arithmetic mean
    let sumX = 0;
    let sumY = 0;
    for (const p of points) {
      sumX += p.x;
      sumY += p.y;
    }
    return { x: sumX / points.length, y: sumY / points.length };
  }

  cx /= 6 * signedArea;
  cy /= 6 * signedArea;

  // Clamp within 0-1
  return {
    x: Math.max(0.01, Math.min(0.99, cx)),
    y: Math.max(0.01, Math.min(0.99, cy))
  };
}

/**
 * Computes bounding box of polygon vertices in 0-1 coordinate space.
 */
export function computePolygonBounds(points: Point2D[]) {
  if (!points || points.length === 0) {
    return { minX: 0, minY: 0, maxX: 1, maxY: 1, width: 1, height: 1 };
  }
  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;

  for (let i = 1; i < points.length; i++) {
    if (points[i].x < minX) minX = points[i].x;
    if (points[i].x > maxX) maxX = points[i].x;
    if (points[i].y < minY) minY = points[i].y;
    if (points[i].y > maxY) maxY = points[i].y;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  };
}

/**
 * Standard ray-casting algorithm to test if a point is inside a polygon.
 */
export function isPointInPolygon(px: number, py: number, points: Point2D[]): boolean {
  if (!points || points.length < 3) return false;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;

    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Checks if a token at (tokenX, tokenY) in percentage (0-100) is inside a zone.
 */
export function isTokenInAnyZone(
  tokenPctX: number,
  tokenPctY: number,
  zone: PlacementZone,
  aspectRatio: number
): boolean {
  if (zone.type === 'rect') {
    const halfW = zone.width / 2;
    const halfH = zone.height / 2;
    return (
      tokenPctX >= zone.x - halfW &&
      tokenPctX <= zone.x + halfW &&
      tokenPctY >= zone.y - halfH &&
      tokenPctY <= zone.y + halfH
    );
  } else if (zone.type === 'circle') {
    const dx = tokenPctX - zone.x;
    const dy = (tokenPctY - zone.y) / (aspectRatio || 1);
    const radius = zone.width / 2;
    return dx * dx + dy * dy <= radius * radius;
  } else if (zone.type === 'polygon' && zone.points && zone.points.length >= 3) {
    // Convert 0-100 pct to 0-1 relative
    const rx = tokenPctX / 100;
    const ry = tokenPctY / 100;
    return isPointInPolygon(rx, ry, zone.points);
  }
  return false;
}

/**
 * Applies Chaikin corner smoothing to a closed polygon.
 * smoothing is 0 to 1.
 */
export function smoothPolygonPoints(points: Point2D[], smoothing: number): Point2D[] {
  if (!points || points.length < 3 || smoothing <= 0) return points;

  // Number of iterations: 1 or 2
  const iterations = smoothing > 0.5 ? 2 : 1;
  const factor = Math.min(0.25, smoothing * 0.25);

  let current = points;
  for (let iter = 0; iter < iterations; iter++) {
    const next: Point2D[] = [];
    const len = current.length;
    for (let i = 0; i < len; i++) {
      const p0 = current[i];
      const p1 = current[(i + 1) % len];

      const q = {
        x: p0.x * (1 - factor) + p1.x * factor,
        y: p0.y * (1 - factor) + p1.y * factor
      };
      const r = {
        x: p0.x * factor + p1.x * (1 - factor),
        y: p0.y * factor + p1.y * (1 - factor)
      };

      next.push(q, r);
    }
    current = next;
  }

  return current;
}

/**
 * Draws a smoothed or sharp polygon on an HTML5 2D canvas.
 * Coordinates in pixels.
 */
export function drawPolygonOnCanvas(
  ctx: CanvasRenderingContext2D,
  points: Point2D[],
  baseWidth: number,
  baseHeight: number,
  smoothing = 0
): void {
  if (!points || points.length < 2) return;

  const pts = smoothing > 0 ? smoothPolygonPoints(points, smoothing) : points;
  if (pts.length < 2) return;

  ctx.beginPath();
  ctx.moveTo(pts[0].x * baseWidth, pts[0].y * baseHeight);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i].x * baseWidth, pts[i].y * baseHeight);
  }
  ctx.closePath();
}

export interface PlacedBadgeLayout {
  id: string;
  bx: number; // badge center x in px
  by: number; // badge center y in px
  bw: number; // badge width in px
  bh: number; // badge height in px
  text: string;
  color: string;
}

/**
 * Smart collision-avoiding and boundary-clamping label layout for placed tower tokens.
 * Computes positions in pixel space.
 */
export function calculateTokenBadgePositions(
  tokens: PlacedMapToken[],
  zones: PlacementZone[],
  canvasWidth: number,
  canvasHeight: number,
  aspectRatio: number,
  fontSize: number
): PlacedBadgeLayout[] {
  const padding = 12; // keep within canvas boundary
  const baseDiameter = canvasWidth * 0.052;
  const results: PlacedBadgeLayout[] = [];

  // Sort tokens to place consistently
  tokens.forEach(tok => {
    if (!tok.label) return;
    const tx = (tok.x / 100) * canvasWidth;
    const ty = (tok.y / 100) * canvasHeight;
    const d = Math.max(22, baseDiameter * (tok.size ?? 1));
    const r = d / 2;

    const inZone = zones.some(z => isTokenInAnyZone(tok.x, tok.y, z, aspectRatio));
    const color = inZone ? '#9ca3af' : tok.color || '#ffffff';

    const text = tok.label.slice(0, 6);
    // Estimated badge width based on fontSize and text length
    const approxCharW = fontSize * 0.65;
    const bw = Math.max(fontSize * 1.5, text.length * approxCharW + fontSize * 0.7);
    const bh = Math.max(fontSize * 1.35, 18);

    // Candidates in priority order:
    // 1. Top-Right (standard TDS convention)
    // 2. Top-Center
    // 3. Bottom-Center
    // 4. Right
    // 5. Left
    // 6. Bottom-Right
    const candidates = [
      { bx: tx + r * 0.6, by: ty - r * 0.65 },
      { bx: tx, by: ty - r - bh / 2 - 4 },
      { bx: tx, by: ty + r + bh / 2 + 4 },
      { bx: tx + r + bw / 2 + 4, by: ty },
      { bx: tx - r - bw / 2 - 4, by: ty },
      { bx: tx + r * 0.6, by: ty + r * 0.65 }
    ];

    let bestX = candidates[0].bx;
    let bestY = candidates[0].by;
    let bestScore = Infinity;

    for (let i = 0; i < candidates.length; i++) {
      let candX = candidates[i].bx;
      let candY = candidates[i].by;

      // Clamp within map bounds
      candX = Math.max(padding + bw / 2, Math.min(canvasWidth - padding - bw / 2, candX));
      candY = Math.max(padding + bh / 2, Math.min(canvasHeight - padding - bh / 2, candY));

      // Calculate overlap score
      let score = i * 10; // slight penalty for non-standard positions

      // Check overlap with other already placed badges
      for (const placed of results) {
        const overlapX = Math.max(0, Math.min(candX + bw / 2, placed.bx + placed.bw / 2) - Math.max(candX - bw / 2, placed.bx - placed.bw / 2));
        const overlapY = Math.max(0, Math.min(candY + bh / 2, placed.by + placed.bh / 2) - Math.max(candY - bh / 2, placed.by - placed.bh / 2));
        if (overlapX > 0 && overlapY > 0) {
          score += 1000 * (overlapX * overlapY);
        }
      }

      // Check overlap with token center circle
      const distToToken = Math.hypot(candX - tx, candY - ty);
      if (distToToken < r * 0.5) {
        score += 500;
      }

      if (score < bestScore) {
        bestScore = score;
        bestX = candX;
        bestY = candY;
      }
    }

    results.push({
      id: tok.id,
      bx: bestX,
      by: bestY,
      bw,
      bh,
      text,
      color
    });
  });

  return results;
}
