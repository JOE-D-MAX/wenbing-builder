'use client';

import { useEffect, useRef } from 'react';

type Star = { x: number; y: number; depth: number; radius: number; phase: number; color: string; sparkle: boolean };
type TrailPoint = { x: number; y: number; born: number; color: string; radius: number };

// Canvas decoration never intercepts input, and pauses when the hero is hidden.
export function LiftoffEffects({compact = false}: {compact?: boolean}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const hero = canvas?.closest<HTMLElement>('[data-liftoff-surface], .hero');
    const context = canvas?.getContext('2d');
    if (!canvas || !hero || !context) return;

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const hints = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    const constrained = !!hints.connection?.saveData || (hints.deviceMemory ?? 8) <= 2 || (navigator.hardwareConcurrency || 4) <= 2;
    const colors = ['#567eee', '#8970d5', '#b574ab', '#548daf', '#a589c1'];
    const noise = (index: number, salt: number) => {
      const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
      return value - Math.floor(value);
    };
    let stars: Star[] = [], trail: TrailPoint[] = [];
    let width = 0, height = 0, frame = 0, visible = true, last = 0, elapsed = 0;
    let targetX = 0, targetY = 0, cursorX = 0, cursorY = 0, pointerStrength = 0;
    let activePointer = false, previousX = 0, previousY = 0, trailIndex = 0;
    let bounds: DOMRect | null = null, boundsDirty = true;
    let pendingPointer: { x: number; y: number } | null = null;
    let nextPaint = 0;

    const sparkle = (x: number, y: number, radius: number, color: string) => {
      context.fillStyle = color;
      context.beginPath();
      context.moveTo(x, y - radius);
      context.quadraticCurveTo(x, y, x + radius, y);
      context.quadraticCurveTo(x, y, x, y + radius);
      context.quadraticCurveTo(x, y, x - radius, y);
      context.quadraticCurveTo(x, y, x, y - radius);
      context.fill();
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      const mouseX = width ? (cursorX / width - 0.5) * pointerStrength : 0;
      const mouseY = height ? (cursorY / height - 0.5) * pointerStrength : 0;

      // A broad, soft lens follows the cursor behind the readable content.
      if (pointerStrength > 0.01) {
        const glow = context.createRadialGradient(cursorX, cursorY, 3, cursorX, cursorY, 160);
        glow.addColorStop(0, '#92aef72e');
        glow.addColorStop(0.42, '#c4aff21d');
        glow.addColorStop(1, '#c4aff200');
        context.globalAlpha = pointerStrength;
        context.fillStyle = glow;
        context.fillRect(cursorX - 160, cursorY - 160, 320, 320);
      }

      const nearby: { x: number; y: number; influence: number }[] = [];
      for (const star of stars) {
        let x = star.x * width + Math.sin(elapsed * 0.00013 + star.phase) * (7 + star.depth * 10) + mouseX * 42 * star.depth;
        let y = star.y * height + Math.cos(elapsed * 0.0001 + star.phase) * (8 + star.depth * 8) + mouseY * 30 * star.depth;
        const dx = cursorX - x, dy = cursorY - y;
        const distanceSquared = dx * dx + dy * dy;
        const influence = pointerStrength > 0.01 && distanceSquared < 27225 ? (1 - Math.sqrt(distanceSquared) / 165) * pointerStrength : 0;
        // A small orbit brings nearby stars toward the cursor without a jump.
        x += (dx * 0.42 - dy * 0.2) * influence;
        y += (dy * 0.42 + dx * 0.2) * influence;
        const quietCenter = x > width * 0.29 && x < width * 0.71 && y < 500 ? 0.58 : 1;
        const twinkle = 0.68 + Math.sin(elapsed * 0.0013 + star.phase) * 0.22;
        context.globalAlpha = Math.min(0.86, (0.26 + star.depth * 0.39 + influence * 0.45) * twinkle * quietCenter);
        const radius = star.radius * (1 + influence * 0.95);
        if (star.sparkle) {
          sparkle(x, y, radius * 2.5, star.color);
        } else {
          context.fillStyle = star.color;
          context.beginPath();
          context.arc(x, y, radius, 0, Math.PI * 2);
          context.fill();
        }
        if (influence > 0.16 && nearby.length < 24) nearby.push({ x, y, influence });
      }

      // The temporary constellation only appears close to the pointer.
      context.strokeStyle = '#7796d7';
      context.lineWidth = 0.65;
      for (let i = 0; i < nearby.length; i++) {
        for (let j = i + 1; j < nearby.length; j++) {
          const a = nearby[i], b = nearby[j];
          const distance = Math.hypot(a.x - b.x, a.y - b.y);
          if (distance > 65) continue;
          context.globalAlpha = (1 - distance / 65) * Math.min(a.influence, b.influence) * 0.42;
          context.beginPath();
          context.moveTo(a.x, a.y);
          context.lineTo(b.x, b.y);
          context.stroke();
        }
      }

      trail = trail.filter(point => elapsed - point.born < 850);
      for (let i = 0; i < trail.length; i++) {
        const point = trail[i];
        const life = 1 - (elapsed - point.born) / 850;
        const drift = (1 - life) * 13;
        context.globalAlpha = life * life * 0.7;
        context.fillStyle = point.color;
        const x = point.x + Math.sin(i * 1.7) * drift;
        const y = point.y - drift;
        if (i % 5 === 0) sparkle(x, y, point.radius * (1 + life), point.color);
        else {
          context.beginPath();
          context.arc(x, y, point.radius * life, 0, Math.PI * 2);
          context.fill();
        }
        const previous = trail[i - 1];
        if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 30) {
          context.globalAlpha = life * 0.24;
          context.strokeStyle = point.color;
          context.lineWidth = 1.3 * life;
          context.beginPath();
          context.moveTo(previous.x, previous.y);
          context.lineTo(point.x, point.y);
          context.stroke();
        }
      }

      // Two short shooting stars pass through the open edges, several seconds apart.
      if (!motion.matches) {
        for (let i = 0; i < 2; i++) {
          const flight = ((elapsed + i * 3700) % 8200) / 1150;
          if (flight >= 1) continue;
          const x = width * (i ? 0.74 : 0.08) + flight * width * 0.14;
          const y = 40 + i * 270 + flight * 95;
          const gradient = context.createLinearGradient(x - 54, y - 33, x, y);
          gradient.addColorStop(0, '#779ae800');
          gradient.addColorStop(1, '#779ae8');
          context.strokeStyle = gradient;
          context.globalAlpha = Math.sin(flight * Math.PI) * 0.7;
          context.lineWidth = 1.4;
          context.beginPath();
          context.moveTo(x - 54, y - 33);
          context.lineTo(x, y);
          context.stroke();
          sparkle(x, y, 3, '#779ae8');
        }
      }
      if (pointerStrength > 0.01) {
        context.globalAlpha = pointerStrength * 0.68;
        sparkle(cursorX, cursorY, 4, '#6687d7');
      }
      context.globalAlpha = 1;
    };

    const tick = (time: number) => {
      // Decorations have a smaller frame and pixel budget on touch/low-memory devices.
      const compact = width < 600 || !pointer.matches;
      const interval = 1000 / (constrained ? compact ? 12 : 20 : compact ? 20 : 30);
      if (!last || time >= nextPaint) {
        const delta = last ? Math.min(time - last, 100) : interval;
        elapsed += delta;
        last = time;
        nextPaint = nextPaint ? nextPaint + interval : time + interval;
        if (nextPaint < time) nextPaint = time + interval;
        flushPointer();
        const smoothing = 1 - Math.exp(-delta / 70);
        cursorX += (targetX - cursorX) * smoothing;
        cursorY += (targetY - cursorY) * smoothing;
        pointerStrength += ((activePointer ? 1 : 0) - pointerStrength) * smoothing;
        draw();
      }
      frame = requestAnimationFrame(tick);
    };
    const resetPointer = () => {
      activePointer = false;
      pointerStrength = 0;
      trail = [];
      pendingPointer = null;
      hero.style.removeProperty('--pointer-x');
      hero.style.removeProperty('--pointer-y');
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      nextPaint = 0;
      if (motion.matches || !pointer.matches || !visible || document.hidden) resetPointer();
      const paused = !visible || document.hidden || motion.matches;
      hero.toggleAttribute('data-effects-paused', paused);
      if (visible && !document.hidden) draw();
      if (!paused) frame = requestAnimationFrame(tick);
    };
    const resize = () => {
      const previousWidth = width;
      width = hero.clientWidth;
      height = hero.clientHeight;
      boundsDirty = true;
      const compact = width < 600 || !pointer.matches;
      const pixelBudget = constrained ? 650000 : compact ? 900000 : 2200000;
      const ratio = Math.min(window.devicePixelRatio || 1, compact ? 1.25 : 1.5, Math.sqrt(pixelBudget / Math.max(1, width * height)));
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (previousWidth !== width || !stars.length) {
        stars = Array.from({ length: Math.round((constrained ? compact ? 48 : 130 : compact ? 85 : 240) * (canvas.dataset.compact === 'true' ? .35 : 1)) }, (_, i) => {
          const depth = noise(i, 3);
          return {
            x: noise(i, 1), y: noise(i, 2), depth,
            radius: 0.55 + depth * 1.25, phase: noise(i, 4) * Math.PI * 2,
            color: colors[i % colors.length], sparkle: i % 13 === 0,
          };
        });
      }
      if (!activePointer) {
        cursorX = targetX = width / 2;
        cursorY = targetY = height / 2;
      }
      draw();
    };
    const flushPointer = () => {
      if (!pendingPointer || !width || !height) return;
      if (boundsDirty || !bounds) {
        bounds = hero.getBoundingClientRect();
        boundsDirty = false;
      }
      targetX = pendingPointer.x - bounds.left;
      targetY = pendingPointer.y - bounds.top;
      pendingPointer = null;
      if (!activePointer) {
        cursorX = previousX = targetX;
        cursorY = previousY = targetY;
      }
      const distance = Math.hypot(targetX - previousX, targetY - previousY);
      const steps = Math.min(12, Math.ceil(distance / 9));
      for (let i = 1; i <= steps; i++) {
        trail.push({
          x: previousX + (targetX - previousX) * i / steps,
          y: previousY + (targetY - previousY) * i / steps,
          born: elapsed, color: colors[trailIndex++ % colors.length], radius: 1.1 + noise(trailIndex, 6) * 1.5,
        });
      }
      if (trail.length > 100) trail = trail.slice(-100);
      previousX = targetX;
      previousY = targetY;
      activePointer = true;
      hero.style.setProperty('--pointer-x', String(targetX / width - 0.5));
      hero.style.setProperty('--pointer-y', String(targetY / height - 0.5));
    };
    const move = (event: PointerEvent) => {
      if (!pointer.matches || motion.matches || !visible || document.hidden || event.pointerType === 'touch') return;
      // Coalesce high-frequency pointer events into a single update per painted frame.
      pendingPointer = { x: event.clientX, y: event.clientY };
    };
    const leave = () => {
      activePointer = false;
      pendingPointer = null;
      hero.style.setProperty('--pointer-x', '0');
      hero.style.setProperty('--pointer-y', '0');
    };
    const invalidateBounds = () => { boundsDirty = true; };
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(hero);
    const visibilityObserver = typeof IntersectionObserver === 'function' ? new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    }) : null;
    visibilityObserver?.observe(hero);
    const revealObserver = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          revealObserver?.unobserve(entry.target);
        }
      }
    }, { threshold: 0.12 }) : null;
    document.querySelectorAll('.reveal').forEach(element => revealObserver ? revealObserver.observe(element) : element.classList.add('in-view'));
    hero.toggleAttribute('data-effects-quiet', constrained);
    hero.addEventListener('pointermove', move);
    hero.addEventListener('pointerleave', leave);
    window.addEventListener('scroll', invalidateBounds, { passive: true });
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', sync);
    const listen = (query: MediaQueryList) => {
      if (query.addEventListener) query.addEventListener('change', sync);
      else query.addListener(sync);
    };
    const unlisten = (query: MediaQueryList) => {
      if (query.removeEventListener) query.removeEventListener('change', sync);
      else query.removeListener(sync);
    };
    listen(motion);
    listen(pointer);
    resize();
    sync();

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      visibilityObserver?.disconnect();
      revealObserver?.disconnect();
      hero.removeEventListener('pointermove', move);
      hero.removeEventListener('pointerleave', leave);
      window.removeEventListener('scroll', invalidateBounds);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', sync);
      unlisten(motion);
      unlisten(pointer);
      hero.removeAttribute('data-effects-paused');
      hero.removeAttribute('data-effects-quiet');
      resetPointer();
    };
  }, []);

  return <canvas ref={canvasRef} className="liftoff-particles" data-compact={compact} aria-hidden="true" />;
}
