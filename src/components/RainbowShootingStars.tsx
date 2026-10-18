import React, { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  speed: number; // px per millisecond
  trailLen: number; // current visible trail length in px
  maxTrailLen: number; // max trail length in px
  isAlive: boolean;
  size: number;
  rotation: number;
  rotationSpeed: number; // radians per 16.67ms
  distanceTraveled: number;
  totalDistance: number;
  opacity: number;
  startAt: number; // performance.now() timestamp when the star becomes active
}

// Pre-rendered star head (aura + 4-point flare + core). Drawn once, reused every frame.
const HEAD_BASE_RADIUS = 6;
const HEAD_SPRITE_SIZE = 64;

const createHeadSprite = (): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = HEAD_SPRITE_SIZE;
  c.height = HEAD_SPRITE_SIZE;
  const g = c.getContext('2d');
  if (!g) return c;
  const r = HEAD_BASE_RADIUS;
  g.translate(HEAD_SPRITE_SIZE / 2, HEAD_SPRITE_SIZE / 2);

  // soft aura
  g.fillStyle = 'rgba(255,255,255,0.38)';
  g.beginPath();
  g.arc(0, 0, r * 3.2, 0, Math.PI * 2);
  g.fill();

  g.fillStyle = '#fff';
  const spikeLen = r * 3.9;
  const spikeWidth = r * 0.45;

  const spike = (len: number, w: number, vertical: boolean) => {
    g.beginPath();
    if (vertical) {
      g.moveTo(0, -len);
      g.quadraticCurveTo(-w, 0, 0, len);
      g.quadraticCurveTo(w, 0, 0, -len);
    } else {
      g.moveTo(-len, 0);
      g.quadraticCurveTo(0, -w, len, 0);
      g.quadraticCurveTo(0, w, -len, 0);
    }
    g.fill();
  };

  spike(spikeLen, spikeWidth, false);
  spike(spikeLen, spikeWidth, true);
  g.rotate(Math.PI / 4);
  spike(spikeLen * 0.45, spikeWidth * 0.45, false);
  spike(spikeLen * 0.45, spikeWidth * 0.45, true);
  g.rotate(-Math.PI / 4);

  // bright core
  g.beginPath();
  g.arc(0, 0, r * 1.05, 0, Math.PI * 2);
  g.fill();
  return c;
};

const MAX_DPR = 1.25;
const MAX_STARS = 4; // hard cap of simultaneously alive stars -> they can never pile up
const MIN_FRAME_MS = 12; // caps rendering at ~72fps on 144Hz screens, 60fps otherwise
const FRAME_UNIT = 1000 / 60;

// Only ONE star-system may exist at a time (protects from hot-reload / double-mount duplicates)
let disposeActiveSystem: (() => void) | null = null;

export const RainbowShootingStars: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Respect "reduce motion" system setting
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Kill any previous system before starting a new one
    if (disposeActiveSystem) disposeActiveSystem();

    const headSprite = createHeadSprite();

    const stars: Star[] = [];
    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = 1;
    let rafId: number | null = null;
    let resizeRaf: number | null = null;
    let waveTimer: ReturnType<typeof setTimeout> | null = null; // the ONLY timer in the system
    let lastFrame = 0;
    let disposed = false;

    // Cycle pattern: 2 -> 3 -> 2 -> 1 -> repeat
    const CYCLE_PATTERN = [2, 3, 2, 1];
    let cycleIndex = 0;

    const resizeCanvas = () => {
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    };
    resizeCanvas();

    const onResize = () => {
      if (resizeRaf !== null) return;
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = null;
        resizeCanvas();
      });
    };
    window.addEventListener('resize', onResize, { passive: true });

    const getOrigin = (): { x: number; y: number } => {
      const btn = document.getElementById('strategies-nav-cta');
      if (btn) {
        const rect = btn.getBoundingClientRect();
        return {
          x: rect.left + rect.width * 0.5 + (Math.random() * 30 - 15),
          y: Math.max(12, rect.top + rect.height * 0.3 + (Math.random() * 16 - 8))
        };
      }
      return {
        x: width * 0.85 + (Math.random() * 40 - 20),
        y: 28 + (Math.random() * 14 - 7)
      };
    };

    const spawnStar = (startAt: number) => {
      const origin = getOrigin();
      const startX = origin.x + (Math.random() * 36 - 18);
      const startY = origin.y + (Math.random() * 18 - 9);

      const targetX = -60 + Math.random() * (width * 0.22);
      const targetY = height * 0.75 + Math.random() * (height * 0.3);

      const dx = targetX - startX;
      const dy = targetY - startY;
      const dist = Math.hypot(dx, dy) || 1;
      const speedPerFrame = 12.5 + Math.random() * 4; // px per 60fps frame
      const speed = speedPerFrame / FRAME_UNIT; // px per ms

      stars.push({
        x: startX,
        y: startY,
        dirX: dx / dist,
        dirY: dy / dist,
        speed,
        trailLen: 0,
        maxTrailLen: (42 + Math.floor(Math.random() * 16)) * speedPerFrame,
        isAlive: true,
        size: 2.6 + Math.random() * 1.2,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: 0.08 * (Math.random() > 0.5 ? 1 : -1),
        distanceTraveled: 0,
        totalDistance: dist + 160,
        opacity: 1,
        startAt
      });
    };

    const clearCanvas = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const stopLoop = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    const clearWaveTimer = () => {
      if (waveTimer !== null) {
        clearTimeout(waveTimer);
        waveTimer = null;
      }
    };

    // Tapered trail as ONE filled polygon with a gradient
    const drawTrail = (star: Star, widthHead: number, alphaMul: number) => {
      const len = star.trailLen;
      if (len < 1) return;
      const hx = star.x;
      const hy = star.y;
      const tx = hx - star.dirX * len;
      const ty = hy - star.dirY * len;
      const nx = -star.dirY;
      const ny = star.dirX;
      const hw = widthHead / 2;
      const tw = Math.max(0.17, widthHead * 0.09);

      const grad = ctx.createLinearGradient(hx, hy, tx, ty);
      grad.addColorStop(0, `rgba(255,255,255,${(alphaMul * star.opacity).toFixed(3)})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(hx + nx * hw, hy + ny * hw);
      ctx.lineTo(tx + nx * tw, ty + ny * tw);
      ctx.lineTo(tx - nx * tw, ty - ny * tw);
      ctx.lineTo(hx - nx * hw, hy - ny * hw);
      ctx.closePath();
      ctx.fill();
    };

    const render = (now: number) => {
      rafId = null;
      if (disposed) return;
      if (document.hidden) {
        stars.length = 0;
        clearCanvas();
        return;
      }

      // Frame limiter (also keeps the loop cheap on high-refresh monitors)
      if (lastFrame && now - lastFrame < MIN_FRAME_MS) {
        rafId = requestAnimationFrame(render);
        return;
      }
      // Clamp dt so a stalled frame / returning to the tab can never make stars "jump" or burst
      const dt = lastFrame ? Math.min(now - lastFrame, 50) : FRAME_UNIT;
      lastFrame = now;
      const k = dt / FRAME_UNIT;

      clearCanvas();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      for (let i = stars.length - 1; i >= 0; i--) {
        const star = stars[i];
        if (now < star.startAt) continue; // staggered spawn: not active yet

        if (star.isAlive) {
          const step = star.speed * dt;
          star.x += star.dirX * step;
          star.y += star.dirY * step;
          star.rotation += star.rotationSpeed * k;
          star.distanceTraveled += step;
          star.trailLen = Math.min(star.maxTrailLen, star.trailLen + step);

          if (star.x < -80 || star.y > height + 80 || star.distanceTraveled >= star.totalDistance) {
            star.isAlive = false;
          }
        } else {
          // trail dissipates: tail catches up with head while star fades
          star.opacity -= 0.05 * k;
          star.trailLen -= star.speed * dt;
        }

        if (!star.isAlive && (star.opacity <= 0 || star.trailLen < star.speed * FRAME_UNIT * 2)) {
          stars.splice(i, 1);
          continue;
        }

        // soft glow + crisp core trail
        drawTrail(star, 5, 0.28);
        drawTrail(star, 2, 0.95);

        if (star.isAlive && star.opacity > 0) {
          const scale = star.size / HEAD_BASE_RADIUS;
          const cos = Math.cos(star.rotation) * scale;
          const sin = Math.sin(star.rotation) * scale;
          ctx.setTransform(cos * dpr, sin * dpr, -sin * dpr, cos * dpr, star.x * dpr, star.y * dpr);
          ctx.globalAlpha = star.opacity;
          ctx.drawImage(headSprite, -HEAD_SPRITE_SIZE / 2, -HEAD_SPRITE_SIZE / 2);
          ctx.globalAlpha = 1;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
      }

      if (stars.length > 0) {
        rafId = requestAnimationFrame(render);
      } else {
        // Nothing left to animate: wipe once and stop the loop completely (0% CPU while idle)
        clearCanvas();
        lastFrame = 0;
      }
    };

    const startLoop = () => {
      if (rafId === null && !disposed) rafId = requestAnimationFrame(render);
    };

    const scheduleWave = (delay: number) => {
      clearWaveTimer(); // never more than one pending timer
      waveTimer = setTimeout(runWave, delay);
    };

    function runWave() {
      waveTimer = null;
      if (disposed || document.hidden) return;

      const starCount = CYCLE_PATTERN[cycleIndex];
      cycleIndex = (cycleIndex + 1) % CYCLE_PATTERN.length;

      const now = performance.now();
      for (let i = 0; i < starCount; i++) {
        if (stars.length >= MAX_STARS) break;
        spawnStar(now + i * (280 + Math.random() * 100));
      }
      if (stars.length > 0) startLoop();

      scheduleWave(3800 + Math.random() * 900 + starCount * 280);
    }

    // Pause everything the moment the page is hidden / left, restart cleanly when it is back
    const pause = () => {
      clearWaveTimer();
      stopLoop();
      stars.length = 0;
      lastFrame = 0;
      clearCanvas();
    };
    const resume = () => {
      if (disposed || document.hidden) return;
      pause(); // guarantees a clean state: no leftover stars, loops or timers
      scheduleWave(1200);
    };

    const onVisibility = () => (document.hidden ? pause() : resume());
    const onPageHide = () => pause();
    const onPageShow = () => resume();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);

    scheduleWave(800);

    const dispose = () => {
      if (disposed) return;
      disposed = true;
      stopLoop();
      clearWaveTimer();
      stars.length = 0;
      if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('resize', onResize);
      if (disposeActiveSystem === dispose) disposeActiveSystem = null;
    };
    disposeActiveSystem = dispose;

    return dispose;
  }, []);

  return (
    <canvas
      ref={canvasRef}
      /* z-[1] keeps the stars BEHIND all buttons, cards, and header navigation */
      className="fixed inset-0 pointer-events-none z-[1]"
      style={{
        width: '100%',
        height: '100%',
        display: 'block'
      }}
      aria-hidden="true"
    />
  );
};
