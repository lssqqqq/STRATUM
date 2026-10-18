import React, { useEffect, useRef } from 'react';

/**
 * Lightweight "deep space" backdrop.
 *
 * - Stars are painted ONCE onto canvases (no per-frame JS, no animation loop).
 * - Twinkling is done by fading two whole canvas layers with a CSS opacity animation,
 *   which runs on the GPU compositor and costs essentially nothing.
 * - Nebula glows use theme CSS variables, so they follow the selected site theme.
 */

const DPR_CAP = 1.25;
const STAR_TINTS = ['255,255,255', '255,255,255', '200,220,255', '255,236,210', '222,208,255'];

// Small seeded PRNG: the same sky is drawn after every resize (no flickering layout)
const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const paintStars = (canvas: HTMLCanvasElement, w: number, h: number, seed: number, count: number) => {
  const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const rand = mulberry32(seed);

  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const kind = rand();
    const tint = STAR_TINTS[Math.floor(rand() * STAR_TINTS.length)];

    // size classes: many tiny, some medium, very few bright "sparkles"
    let r: number;
    let alpha: number;
    if (kind < 0.74) {
      r = 0.55 + rand() * 0.45;
      alpha = 0.3 + rand() * 0.45;
    } else if (kind < 0.96) {
      r = 0.95 + rand() * 0.6;
      alpha = 0.5 + rand() * 0.4;
    } else {
      r = 1.5 + rand() * 0.7;
      alpha = 0.8 + rand() * 0.2;
    }

    // soft halo for bigger stars
    if (r > 0.95) {
      const haloR = r * (kind >= 0.96 ? 7 : 4.5);
      const halo = ctx.createRadialGradient(x, y, 0, x, y, haloR);
      halo.addColorStop(0, `rgba(${tint},${(alpha * 0.45).toFixed(3)})`);
      halo.addColorStop(1, `rgba(${tint},0)`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, haloR, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = `rgba(${tint},${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // thin 4-point flare on the brightest stars
    if (kind >= 0.96) {
      const len = r * 6;
      ctx.strokeStyle = `rgba(${tint},${(alpha * 0.55).toFixed(3)})`;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x - len, y);
      ctx.lineTo(x + len, y);
      ctx.moveTo(x, y - len);
      ctx.lineTo(x, y + len);
      ctx.stroke();
    }
  }
};

export const SpaceBackground: React.FC = () => {
  const staticRef = useRef<HTMLCanvasElement | null>(null);
  const twinkleARef = useRef<HTMLCanvasElement | null>(null);
  const twinkleBRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let lastW = 0;
    let lastH = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const draw = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      // Ignore tiny height changes (mobile address bar) so the sky is not repainted for nothing
      if (lastW && Math.abs(w - lastW) < 40 && Math.abs(h - lastH) < 140) return;
      lastW = w;
      lastH = h;

      const total = Math.max(90, Math.min(420, Math.round((w * h) / 7000)));
      if (staticRef.current) paintStars(staticRef.current, w, h, 1337, Math.round(total * 0.5));
      if (twinkleARef.current) paintStars(twinkleARef.current, w, h, 7331, Math.round(total * 0.27));
      if (twinkleBRef.current) paintStars(twinkleBRef.current, w, h, 4242, Math.round(total * 0.23));
    };

    draw();

    const onResize = () => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(draw, 250);
    };
    window.addEventListener('resize', onResize, { passive: true });

    return () => {
      if (timer !== null) clearTimeout(timer);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const layer = 'fixed inset-0 w-full h-full pointer-events-none z-0';

  return (
    <div aria-hidden="true" style={{ contain: 'layout paint style' }}>
      {/* Nebula glows (follow the active site theme) + soft vignette */}
      <div
        className={layer}
        style={{
          background: [
            'radial-gradient(900px 520px at 50% -8%, color-mix(in srgb, var(--site-flare-1) 20%, transparent), transparent 70%)',
            'radial-gradient(720px 520px at 6% 88%, color-mix(in srgb, var(--site-flare-2) 13%, transparent), transparent 70%)',
            'radial-gradient(620px 460px at 96% 58%, color-mix(in srgb, var(--site-accent) 10%, transparent), transparent 70%)',
            'radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,0.42) 100%)'
          ].join(', ')
        }}
      />

      {/* Stars: one static layer + two layers that twinkle out of phase */}
      <canvas ref={staticRef} className={layer} style={{ opacity: 0.85 }} />
      <canvas ref={twinkleARef} className={`${layer} space-twinkle-a`} />
      <canvas ref={twinkleBRef} className={`${layer} space-twinkle-b`} />
    </div>
  );
};
