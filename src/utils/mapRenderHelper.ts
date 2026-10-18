import { PlacedMapToken, PlacementZone } from '../types/customDoc';
import {
  drawPolygonOnCanvas,
  computePolygonCentroid,
  calculateTokenBadgePositions,
  isTokenInAnyZone
} from './mapGeometryHelper';

export { isTokenInAnyZone as isTokenInZone };

/**
 * Loads an image from a URL, data URI, or local path safely.
 */
export function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    if (!src || !src.trim()) {
      resolve(null);
      return;
    }
    const img = new Image();
    // Do not set anonymous for data URLs or SVG data URLs to avoid canvas taint quirks
    if (!src.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => {
      // Fallback without crossOrigin if failed
      if (img.crossOrigin) {
        const fallback = new Image();
        fallback.onload = () => resolve(fallback);
        fallback.onerror = () => resolve(null);
        fallback.src = src;
      } else {
        resolve(null);
      }
    };
    img.src = src;
  });
}

/**
 * Converts any image source (including SVG data URIs, local PNGs, JPEG) into a standard PNG data URI.
 */
export async function rasterizeImageToPng(
  src: string | undefined,
  maxW?: number,
  maxH?: number
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  if (!src || !src.trim()) return null;
  const img = await loadImage(src);
  if (!img) return null;

  const naturalW = img.naturalWidth || maxW || 120;
  const naturalH = img.naturalHeight || maxH || 120;

  let targetW = naturalW;
  let targetH = naturalH;

  if (maxW && targetW > maxW) {
    targetH = Math.round((targetH * maxW) / targetW);
    targetW = maxW;
  }
  if (maxH && targetH > maxH) {
    targetW = Math.round((targetW * maxH) / targetH);
    targetW = maxH;
  }
  targetW = Math.max(1, targetW);
  targetH = Math.max(1, targetH);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0, targetW, targetH);
  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: targetW,
    height: targetH
  };
}

/** Helper to convert hex color to rgba */
export function hexToRgba(hex: string, alpha: number): string {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map(x => x + x).join('');
  }
  if (c.length !== 6) return `rgba(255, 255, 255, ${alpha})`;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Draw rounded rectangle on canvas */
export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Renders the final customized map canvas to a high-resolution PNG image,
 * preserving the map photo, all placement zones (circle, rect, and polygon),
 * all placed tower tokens, outline rings, smart labels, and customizations.
 */
export async function renderCustomMapToImage(
  mapPhotoUrl: string | undefined,
  tokens: PlacedMapToken[] = [],
  zones: PlacementZone[] = [],
  aspectRatio = 1.6,
  showLabels = true
): Promise<{ dataUrl: string; width: number; height: number; type: 'jpg' | 'png' }> {
  // Render at 2400px (2x previous 1200px resolution) to ensure pristine crispness when displayed 2x larger
  const baseWidth = 2400;
  let ar = aspectRatio && aspectRatio > 0 ? aspectRatio : 1.6;

  let mapImg: HTMLImageElement | null = null;
  if (mapPhotoUrl && mapPhotoUrl.trim()) {
    mapImg = await loadImage(mapPhotoUrl);
    if (mapImg && mapImg.naturalWidth && mapImg.naturalHeight) {
      ar = mapImg.naturalWidth / mapImg.naturalHeight;
    }
  }

  const baseHeight = Math.round(baseWidth / ar);
  const canvas = document.createElement('canvas');
  canvas.width = baseWidth;
  canvas.height = baseHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { dataUrl: '', width: baseWidth, height: baseHeight, type: 'jpg' };
  }

  // 1. Draw Map Background
  if (mapImg) {
    ctx.drawImage(mapImg, 0, 0, baseWidth, baseHeight);
  } else {
    // High-tech dark tactical blueprint background
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, baseWidth, baseHeight);

    // Grid lines
    ctx.strokeStyle = '#18181f';
    ctx.lineWidth = 1.5;
    const step = 48;
    for (let x = 0; x < baseWidth; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, baseHeight);
      ctx.stroke();
    }
    for (let y = 0; y < baseHeight; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(baseWidth, y);
      ctx.stroke();
    }

    // Curving path representation
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 40;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(70, baseHeight * 0.72);
    ctx.lineTo(baseWidth * 0.3, baseHeight * 0.72);
    ctx.lineTo(baseWidth * 0.3, baseHeight * 0.28);
    ctx.lineTo(baseWidth * 0.68, baseHeight * 0.28);
    ctx.lineTo(baseWidth * 0.68, baseHeight * 0.65);
    ctx.lineTo(baseWidth - 70, baseHeight * 0.65);
    ctx.stroke();

    ctx.strokeStyle = '#404040';
    ctx.lineWidth = 26;
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 14]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Watermark badge
    ctx.save();
    ctx.fillStyle = '#111116';
    drawRoundedRect(ctx, 30, 30, 200, 38, 8);
    ctx.fill();
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText('TACTICAL MAP CANVAS', 48, 49);
    ctx.restore();
  }

  // 2. Draw Placement Zones (Circle, Rect, and Polygon)
  zones.forEach(zone => {
    const color = zone.color || '#9ca3af';
    const fillAlpha = zone.fillOpacity ?? 0.22;
    const strokeW = zone.strokeWidth ?? 3;

    ctx.save();
    ctx.fillStyle = hexToRgba(color, fillAlpha);
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeW;
    ctx.setLineDash([8, 6]);

    let cx = (zone.x / 100) * baseWidth;
    let cy = (zone.y / 100) * baseHeight;
    let zw = (zone.width / 100) * baseWidth;
    let zh = zone.type === 'circle' ? zw : (zone.height / 100) * baseHeight;

    if (zone.type === 'circle') {
      ctx.beginPath();
      ctx.arc(cx, cy, zw / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (zone.type === 'polygon' && zone.points && zone.points.length >= 3) {
      drawPolygonOnCanvas(ctx, zone.points, baseWidth, baseHeight, zone.smoothing ?? 0);
      ctx.fill();
      ctx.stroke();

      const centroid = computePolygonCentroid(zone.points);
      cx = centroid.x * baseWidth;
      cy = centroid.y * baseHeight;
    } else {
      drawRoundedRect(ctx, cx - zw / 2, cy - zh / 2, zw, zh, 12);
      ctx.fill();
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Zone Title Tag (if showLabels is true)
    if (showLabels) {
      const label = (zone.label || (zone.type === 'circle' ? 'Circle Zone' : zone.type === 'polygon' ? 'Polygon Zone' : 'Placement Zone')).toUpperCase();
      const fontSize = Math.max(11, Math.round(baseWidth * 0.011));
      ctx.font = `bold ${fontSize}px monospace`;
      const tagTextW = ctx.measureText(label).width;
      const tagW = tagTextW + fontSize * 1.4;
      const tagH = fontSize * 1.8;

      // Position centered at cx, cy, clamped inside canvas bounds with 12px margin
      const margin = 12;
      let tagX = cx - tagW / 2;
      let tagY = cy - tagH / 2;
      tagX = Math.max(margin, Math.min(baseWidth - tagW - margin, tagX));
      tagY = Math.max(margin, Math.min(baseHeight - tagH - margin, tagY));

      ctx.fillStyle = '#111114';
      drawRoundedRect(ctx, tagX, tagY, tagW, tagH, 6);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#f4f4f5';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, tagX + tagW / 2, tagY + tagH / 2);
    }

    ctx.restore();
  });

  // 3. Pre-load Token Tower Images
  const towerImgs = await Promise.all(
    tokens.map(async t => {
      if (t.towerImage && t.towerImage.trim()) {
        const img = await loadImage(t.towerImage);
        return { id: t.id, img };
      }
      return { id: t.id, img: null };
    })
  );
  const imgMap = new Map(towerImgs.map(item => [item.id, item.img]));

  // 4. Draw Placed Tower Tokens
  const baseDiameter = baseWidth * 0.052; // ~62px
  const tokenFontSize = Math.max(11, Math.round(baseWidth * 0.011));

  // Compute smart, collision-avoiding, boundary-clamped badge layout
  const badgeLayouts = showLabels
    ? calculateTokenBadgePositions(tokens, zones, baseWidth, baseHeight, ar, tokenFontSize)
    : [];

  tokens.forEach(tok => {
    const x = (tok.x / 100) * baseWidth;
    const y = (tok.y / 100) * baseHeight;
    const d = Math.max(22, baseDiameter * (tok.size ?? 1));
    const r = d / 2;
    const ringWidth = Math.max(3, d * 0.08);

    const inZone = zones.some(z => isTokenInAnyZone(tok.x, tok.y, z, ar));
    const color = inZone ? '#9ca3af' : tok.color || '#ffffff';

    ctx.save();

    // Dark outer contrast outline / shadow
    ctx.beginPath();
    ctx.arc(x, y, r + ringWidth / 2 + 1, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.lineWidth = ringWidth + 3;
    ctx.stroke();

    // Inner background circle
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = inZone ? 'rgba(156, 163, 175, 0.35)' : hexToRgba(color, 0.28);
    ctx.fill();

    // Tower Photo or Label
    const towerImg = imgMap.get(tok.id);
    if (towerImg) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r - ringWidth / 2, 0, Math.PI * 2);
      ctx.clip();
      const pad = ringWidth + 1;
      ctx.drawImage(towerImg, x - r + pad, y - r + pad, (r - pad) * 2, (r - pad) * 2);
      ctx.restore();
    } else {
      ctx.fillStyle = color;
      ctx.font = `bold ${Math.round(d * 0.36)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tok.label || 'T', x, y);
    }

    // Outer colored stroke ring
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = ringWidth;
    ctx.stroke();

    ctx.restore();
  });

  // 5. Draw Token Badges (clamped, collision-avoided, with readable dark background pill)
  if (showLabels) {
    badgeLayouts.forEach(badge => {
      ctx.save();
      ctx.font = `bold ${tokenFontSize}px monospace`;
      ctx.fillStyle = '#09090b';
      drawRoundedRect(ctx, badge.bx - badge.bw / 2, badge.by - badge.bh / 2, badge.bw, badge.bh, 999);
      ctx.fill();
      ctx.strokeStyle = badge.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badge.text, badge.bx, badge.by);
      ctx.restore();
    });
  }

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.90),
    width: baseWidth,
    height: baseHeight,
    type: 'jpg'
  };
}
