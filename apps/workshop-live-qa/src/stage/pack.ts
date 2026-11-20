/**
 * Where each bubble comes to rest. Bubbles rise from the bottom of the column in lens order and stop at the first
 * bubble above them (or the top), so the most wanted questions crowd the top and nothing overlaps. A bubble never
 * rests above one with a lower packing group (fewer votes never floats above more votes). Pinned bubbles dock in a
 * band at the top; answered ones rest as marbles on a shelf at the bottom. Everything is scaled to fit.
 * Pure and deterministic, so the same data always settles into the same picture.
 */
import { MARBLE_R, type Bubble, type Zone } from './arrange';

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Target {
  id: string;
  x: number;
  y: number;
  r: number;
  zone: Zone;
}

export interface PackItem {
  id: string;
  r: number;
  group: number;
}

/** A small stable hash of an id, in [0, 1). */
export function hash01(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10007) / 10007;
}

/**
 * Pack circles into a rect by letting each rise from the bottom until it touches the top or a placed circle.
 * Returns the centres and whether everything fitted.
 */
export function packRising(items: PackItem[], rect: Rect, gap = 4, steps = 28, flow: 'centre' | 'left' = 'centre'): { placed: Target[]; fits: boolean } {
  const placed: (Target & { group: number })[] = [];
  const width = rect.right - rect.left;
  const centre = (rect.left + rect.right) / 2;
  let fits = true;
  for (const it of items) {
    const r = it.r;
    const lo = rect.left + r;
    const hi = rect.right - r;
    // Preferred x: near the middle, nudged by the id so the column looks poured rather than stacked.
    const pref = flow === 'left' ? rect.left : centre + (hash01(it.id) - 0.5) * width * 0.36;
    // Never above a bubble of a lower group (more votes).
    let floor = rect.top + r;
    for (const p of placed) if (p.group < it.group) floor = Math.max(floor, p.y + 0.5);
    let best: { x: number; y: number; cost: number } | null = null;
    const n = hi > lo ? steps : 0;
    for (let s = 0; s <= n; s++) {
      const x = n === 0 ? centre : lo + ((hi - lo) * s) / n;
      let y = floor;
      for (const p of placed) {
        const d = r + p.r + gap;
        const dx = Math.abs(x - p.x);
        if (dx < d) y = Math.max(y, p.y + Math.sqrt(d * d - dx * dx));
      }
      const cost = y + Math.abs(x - pref) * (flow === 'left' ? 0.02 : 0.35);
      if (!best || cost < best.cost - 1e-6) best = { x, y, cost };
    }
    const spot = best!;
    if (spot.y + r > rect.bottom + 0.5) fits = false;
    placed.push({ id: it.id, x: spot.x, y: spot.y, r, zone: 'main', group: it.group });
  }
  return { placed: placed.map(({ group: _g, ...t }) => t), fits };
}

export interface ColumnLayout {
  targets: Map<string, Target>;
  /** The pinned dock band, or null when nothing is pinned. */
  dock: Rect | null;
  main: Rect;
  shelf: Rect;
  /** Scale applied to the base radii. */
  scale: number;
  marble: number;
}

export interface LayoutOptions {
  /** Share of the main area the bubbles should cover before they are scaled (0..1). */
  fill?: number;
  minScale?: number;
  maxScale?: number;
  gap?: number;
  /** Room above the shelf marbles for its caption. */
  shelfCaption?: number;
  /** Room above the dock bubbles for its caption. */
  dockCaption?: number;
  pad?: number;
}

/** Lay out a whole column: shelf at the bottom, dock at the top, the rising bubbles in between. */
export function layoutColumn(bubbles: Bubble[], rect: Rect, opts: LayoutOptions = {}): ColumnLayout {
  const { fill = 0.36, minScale = 0.3, maxScale = 1.55, gap = 4, shelfCaption = 22, dockCaption = 20, pad = 10 } = opts;
  const width = rect.right - rect.left;
  const targets = new Map<string, Target>();

  // Shelf: marbles in rows, filling from the bottom row up, left to right.
  const shelfItems = bubbles.filter((b) => b.zone === 'shelf').sort((a, b) => a.order - b.order);
  let marble = Math.min(MARBLE_R, Math.max(4, width / 30));
  let cols = Math.max(1, Math.floor((width - 2 * pad + gap) / (2 * marble + gap)));
  let rows = Math.ceil(shelfItems.length / cols);
  while (rows > 3 && marble > 4) {
    marble -= 1;
    cols = Math.max(1, Math.floor((width - 2 * pad + gap) / (2 * marble + gap)));
    rows = Math.ceil(shelfItems.length / cols);
  }
  const shelfH = shelfCaption + Math.max(1, rows) * (2 * marble + gap) + pad;
  const shelf: Rect = { left: rect.left, right: rect.right, bottom: rect.bottom, top: rect.bottom - shelfH };
  shelfItems.forEach((b, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    targets.set(b.id, {
      id: b.id,
      zone: 'shelf',
      r: marble,
      x: rect.left + pad + marble + col * (2 * marble + gap),
      y: shelf.bottom - pad - marble - row * (2 * marble + gap),
    });
  });

  const docked = bubbles.filter((b) => b.zone === 'dock').sort((a, b) => a.order - b.order);
  const rising = bubbles.filter((b) => b.zone === 'main').sort((a, b) => a.order - b.order);
  const inner = { left: rect.left + pad, right: rect.right - pad };
  const mainTop0 = rect.top + pad;
  const mainBottom = shelf.top - pad;

  const area = Math.max(1, (inner.right - inner.left) * (mainBottom - mainTop0));
  const baseArea = [...docked, ...rising].reduce((s, b) => s + Math.PI * b.r * b.r, 0);
  let scale = baseArea > 0 ? Math.sqrt((fill * area) / baseArea) : 1;
  scale = Math.min(maxScale, Math.max(minScale, scale));
  // Keep the biggest bubble narrower than the column.
  const maxR = Math.max(0, ...[...docked, ...rising].map((b) => b.r));
  if (maxR > 0) scale = Math.min(scale, (inner.right - inner.left) / 2 / maxR / 1.05);

  let dock: Rect | null = null;
  let main: Rect = { left: inner.left, right: inner.right, top: mainTop0, bottom: mainBottom };
  for (let attempt = 0; attempt < 14; attempt++) {
    let ok = true;
    let top = mainTop0;
    const placedDock: Target[] = [];
    if (docked.length) {
      const dockRect: Rect = { left: inner.left, right: inner.right, top: rect.top + dockCaption, bottom: mainBottom };
      const res = packRising(
        docked.map((b) => ({ id: b.id, r: b.r * scale, group: 0 })),
        dockRect,
        gap,
      );
      const bottom = Math.max(...res.placed.map((t) => t.y + t.r));
      dock = { left: rect.left, right: rect.right, top: rect.top, bottom: bottom + pad };
      placedDock.push(...res.placed.map((t) => ({ ...t, zone: 'dock' as Zone })));
      top = dock.bottom + pad;
    } else {
      dock = null;
    }
    main = { left: inner.left, right: inner.right, top, bottom: mainBottom };
    const res = packRising(
      rising.map((b) => ({ id: b.id, r: b.r * scale, group: b.group })),
      main,
      gap,
    );
    if (!res.fits || top >= mainBottom) ok = false;
    if (ok || attempt === 13) {
      for (const t of placedDock) targets.set(t.id, t);
      for (const t of res.placed) targets.set(t.id, t);
      break;
    }
    scale *= 0.9;
  }
  return { targets, dock, main, shelf, scale, marble };
}
