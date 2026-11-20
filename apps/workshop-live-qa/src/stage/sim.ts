/**
 * A small spring-and-collision simulation for the rising bubbles. Each bubble is pulled towards its packed resting
 * place by a slightly underdamped spring (so it rises, overshoots a hair and settles), its radius inflates towards its
 * target the same way, and bubbles in the column push each other aside as they pass. The packed targets never
 * overlap, so the system always comes to rest; `settled` tells the caller when to stop the animation loop.
 * Pure functions over plain objects, so it is unit-tested without a DOM.
 */
import type { Zone } from './arrange';
import type { Target } from './pack';

export interface Body {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  vr: number;
  tx: number;
  ty: number;
  tr: number;
  zone: Zone;
}

export interface SimOptions {
  /** Spring stiffness (1/s²) for position. */
  k?: number;
  /** Damping ratio for position (1 = critical). */
  zeta?: number;
  /** Stiffness for the radius (inflation). */
  kr?: number;
  gap?: number;
  /** Collision relaxation passes per step. */
  passes?: number;
}

export function makeBody(t: Target, from?: { x: number; y: number; r?: number }): Body {
  return {
    id: t.id,
    x: from?.x ?? t.x,
    y: from?.y ?? t.y,
    vx: 0,
    vy: 0,
    r: from?.r ?? t.r,
    vr: 0,
    tx: t.x,
    ty: t.y,
    tr: t.r,
    zone: t.zone,
  };
}

/** Advance the simulation by `dt` seconds. Returns the largest speed (px/s, including inflation) after the step. */
export function step(bodies: Body[], dt: number, opts: SimOptions = {}): number {
  const { k = 60, zeta = 0.8, kr = 110, gap = 2, passes = 2 } = opts;
  const c = 2 * zeta * Math.sqrt(k);
  const cr = 2 * 0.85 * Math.sqrt(kr);
  for (const b of bodies) {
    const ax = k * (b.tx - b.x) - c * b.vx;
    // Buoyancy: rising is a little eager, sinking a little lazy, so the motion reads as bubbles rather than a slide.
    const pull = b.ty < b.y ? 1.15 : 0.9;
    const ay = pull * k * (b.ty - b.y) - c * b.vy;
    b.vx += ax * dt;
    b.vy += ay * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    const ar = kr * (b.tr - b.r) - cr * b.vr;
    b.vr += ar * dt;
    b.r = Math.max(1, b.r + b.vr * dt);
  }
  // Only bubbles near their resting place jostle. Bubbles in transit (rising in, overtaking after a vote, dropping to
  // the shelf) slip past the others, so a crowded column can never jam.
  const solid = bodies.filter((b) => b.zone !== 'shelf' && Math.hypot(b.tx - b.x, b.ty - b.y) < b.tr * 1.1);
  for (let pass = 0; pass < passes; pass++) {
    for (let i = 0; i < solid.length; i++) {
      const a = solid[i];
      for (let j = i + 1; j < solid.length; j++) {
        const b = solid[j];
        const d = a.r + b.r + gap;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const dist2 = dx * dx + dy * dy;
        if (dist2 >= d * d) continue;
        let dist = Math.sqrt(dist2);
        if (dist < 1e-4) {
          // Exactly on top of each other: separate along a stable direction.
          dx = a.id < b.id ? -1 : 1;
          dy = 0.01;
          dist = Math.hypot(dx, dy);
        }
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = d - dist;
        // Bigger bubbles shove smaller ones aside.
        const wa = 1 / (a.r * a.r);
        const wb = 1 / (b.r * b.r);
        const sa = wa / (wa + wb);
        const sb = wb / (wa + wb);
        a.x -= nx * overlap * sa;
        a.y -= ny * overlap * sa;
        b.x += nx * overlap * sb;
        b.y += ny * overlap * sb;
        // Remove most of the closing speed so collisions do not bounce forever.
        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rel < 0) {
          const imp = rel * 0.6;
          a.vx += nx * imp * sa;
          a.vy += ny * imp * sa;
          b.vx -= nx * imp * sb;
          b.vy -= ny * imp * sb;
        }
      }
    }
  }
  let max = 0;
  for (const b of bodies) {
    if (!Number.isFinite(b.x) || !Number.isFinite(b.y) || !Number.isFinite(b.r)) {
      // Never let a numerical problem leave a bubble lost: put it where it belongs.
      snap(b);
    }
    max = Math.max(max, Math.hypot(b.vx, b.vy), Math.abs(b.vr) * 2);
  }
  return max;
}

/** Put a body exactly at rest on its target. */
export function snap(b: Body) {
  b.x = b.tx;
  b.y = b.ty;
  b.r = b.tr;
  b.vx = 0;
  b.vy = 0;
  b.vr = 0;
}

/** Largest distance from rest (position and radius) over all bodies. */
export function maxOffset(bodies: Body[]): number {
  let m = 0;
  for (const b of bodies) m = Math.max(m, Math.hypot(b.tx - b.x, b.ty - b.y), Math.abs(b.tr - b.r));
  return m;
}

/** At rest: slow and close to target (or slow for long enough; the caller counts quiet frames). */
export function isQuiet(maxSpeed: number, offset: number): boolean {
  return maxSpeed < 4 && offset < 1.5;
}
