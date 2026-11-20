/**
 * The centrepiece: questions as bubbles rising in a glass column. Upvotes inflate a bubble and it pushes its way up;
 * answered ones pop softly and drop onto the shelf; pinned ones dock at the top. Bubbles are DOM elements moved by a
 * small spring simulation (./sim) through refs, so React only renders when the data changes, and the loop stops as
 * soon as everything is at rest. With reduced motion every bubble is placed at once, with no loop at all.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';

import { cx, useReducedMotion } from '@x10/shared/ui';

import { columnOrder, type Bubble } from './arrange';
import { layoutColumn, type ColumnLayout, type Rect } from './pack';
import { isQuiet, makeBody, maxOffset, snap, step, type Body } from './sim';

export interface ColumnGeometry {
  /** The glass column. */
  column: Rect;
  /** Where labels may sit on either side of the column (null: no labels on that side). */
  left?: Rect | null;
  right?: Rect | null;
  /** Label width. */
  calloutWidth?: number;
}

export interface RisingColumnProps {
  bubbles: Bubble[];
  geometry: (size: { w: number; h: number }) => ColumnGeometry;
  /** Accessible name of the column. */
  label: string;
  focusId?: string | null;
  /** Buttons you can click and tab to (board) or plain decoration over an accessible list (big screen). */
  interactive?: boolean;
  onPick?: (id: string) => void;
  onHover?: (id: string | null) => void;
  /** Accessible name of a bubble. */
  labelFor?: (b: Bubble) => string;
  /** Bubbles that get a label beside the column, in priority order. */
  calloutIds?: string[];
  renderCallout?: (b: Bubble, side: 'left' | 'right') => ReactNode;
  /** Content drawn inside a bubble instead of its vote count (the big screen numbers the top five). */
  badgeFor?: (b: Bubble) => ReactNode;
  /** Short question text inside big bubbles. */
  excerpts?: boolean;
  /** Captions for the dock and the shelf. */
  dockCaption?: ReactNode;
  shelfCaption?: ReactNode;
  /** Ids the viewer voted for (a small check on the bubble). */
  votedIds?: Set<string>;
  mineIds?: Set<string>;
  /** First paint: bubbles rise in from below. */
  intro?: boolean;
  fill?: number;
  className?: string;
  /** Called with the live layout (for overlays that follow a bubble, such as the phone focus card). */
  onLayout?: (layout: ColumnLayout, size: { w: number; h: number }) => void;
}

interface Bump {
  n: number;
  key: number;
}

function useSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const r = el.getBoundingClientRect();
      setSize((s) => (Math.abs(s.w - r.width) < 0.5 && Math.abs(s.h - r.height) < 0.5 ? s : { w: r.width, h: r.height }));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, size };
}

/** Font size of the vote count for a radius. */
const countSize = (r: number) => Math.max(11, Math.min(46, r * 0.6));

export function RisingColumn({
  bubbles,
  geometry,
  label,
  focusId,
  interactive = true,
  onPick,
  onHover,
  labelFor,
  calloutIds = [],
  renderCallout,
  badgeFor,
  excerpts = true,
  dockCaption,
  shelfCaption,
  votedIds,
  mineIds,
  intro = true,
  fill,
  className,
  onLayout,
}: RisingColumnProps) {
  const reduced = useReducedMotion();
  const { ref: boxRef, size } = useSize();
  const geo = useMemo(() => (size.w > 0 ? geometry(size) : null), [geometry, size]);
  const layout = useMemo(() => (geo ? layoutColumn(bubbles, geo.column, fill ? { fill } : {}) : null), [bubbles, geo, fill]);
  const ordered = useMemo(() => columnOrder(bubbles), [bubbles]);

  const bodies = useRef(new Map<string, Body>());
  const els = useRef(new Map<string, HTMLElement>());
  const labels = useRef(new Map<string, HTMLElement>());
  const leaders = useRef(new Map<string, SVGPathElement>());
  const labelH = useRef(new Map<string, number>());
  const raf = useRef<number | null>(null);
  const state = useRef({ last: 0, woke: 0, quiet: 0, first: true });

  /* ---------------------------------------------------------------- callout sides (stable per layout) */

  const hasCallouts = !!renderCallout;

  const sides = useMemo(() => {
    const out = new Map<string, 'left' | 'right'>();
    if (!geo || !layout || !hasCallouts) return out;
    const cap = (r?: Rect | null) => (r ? Math.max(0, Math.floor((r.bottom - r.top) / 70)) : 0);
    const room = { left: cap(geo.left), right: cap(geo.right) };
    const cx0 = (geo.column.left + geo.column.right) / 2;
    for (const id of calloutIds) {
      const t = layout.targets.get(id);
      if (!t) continue;
      // The focused label is a card with actions: it takes about three slots and goes where there is most room.
      const cost = id === focusId ? 3 : 1;
      const pref: 'left' | 'right' = id === focusId ? (room.right >= room.left ? 'right' : 'left') : t.x < cx0 ? 'left' : 'right';
      const other = pref === 'left' ? 'right' : 'left';
      const side = room[pref] >= cost ? pref : room[other] >= cost ? other : null;
      if (!side) continue;
      room[side] -= cost;
      out.set(id, side);
    }
    return out;
  }, [calloutIds, geo, layout, hasCallouts, focusId]);

  /* ---------------------------------------------------------------- painting */

  const paint = useCallback(() => {
    for (const [id, b] of bodies.current) {
      const el = els.current.get(id);
      if (!el) continue;
      const R = Number(el.dataset.r) || b.tr;
      el.style.transform = `translate3d(${(b.x - R).toFixed(2)}px, ${(b.y - R).toFixed(2)}px, 0) scale(${(b.r / R).toFixed(4)})`;
    }
    if (!geo || sides.size === 0) return;
    const w = geo.calloutWidth ?? 300;
    for (const side of ['left', 'right'] as const) {
      const region = side === 'left' ? geo.left : geo.right;
      if (!region) continue;
      const ids = [...sides].filter(([, s]) => s === side).map(([id]) => id);
      const items = ids
        .map((id) => ({ id, b: bodies.current.get(id), h: labelH.current.get(id) ?? 56 }))
        .filter((x): x is { id: string; b: Body; h: number } => !!x.b)
        .sort((a, c) => a.b.ty - c.b.ty);
      const tops = items.map((it) => it.b.y - it.h / 2);
      const gap = 10;
      for (let i = 0; i < items.length; i++) tops[i] = Math.max(tops[i], region.top, i ? tops[i - 1] + items[i - 1].h + gap : -Infinity);
      for (let i = items.length - 1; i >= 0; i--)
        tops[i] = Math.max(region.top, Math.min(tops[i], region.bottom - items[i].h, i < items.length - 1 ? tops[i + 1] - gap - items[i].h : Infinity));
      // Anything that still collides with the label above it (too many for the room) steps aside until there is space.
      let floor = -Infinity;
      const hidden = new Set<string>();
      items.forEach((it, i) => {
        if (tops[i] < floor - 0.5 && it.id !== focusId) hidden.add(it.id);
        else floor = tops[i] + it.h + gap;
      });
      const width = Math.min(w, region.right - region.left);
      const x = side === 'left' ? region.right - width : region.left;
      items.forEach((it, i) => {
        const el = labels.current.get(it.id);
        const off = hidden.has(it.id);
        if (el) {
          el.style.transform = `translate3d(${x.toFixed(1)}px, ${tops[i].toFixed(1)}px, 0)`;
          el.style.visibility = off ? 'hidden' : '';
        }
        const path = leaders.current.get(it.id);
        if (path) path.style.visibility = off ? 'hidden' : '';
        if (path) {
          const by = it.b.y;
          const bx = side === 'left' ? it.b.x - it.b.r - 3 : it.b.x + it.b.r + 3;
          const ly = tops[i] + Math.min(22, it.h / 2);
          const lx = side === 'left' ? x + width + 6 : x - 6;
          const mid = (bx + lx) / 2;
          path.setAttribute('d', `M${bx.toFixed(1)},${by.toFixed(1)} C${mid.toFixed(1)},${by.toFixed(1)} ${mid.toFixed(1)},${ly.toFixed(1)} ${lx.toFixed(1)},${ly.toFixed(1)}`);
        }
      });
    }
  }, [geo, sides, focusId]);

  const paintRef = useRef(paint);
  paintRef.current = paint;

  const setSettled = (v: boolean) => {
    if (boxRef.current) boxRef.current.dataset.settled = String(v);
  };

  const tick = useCallback(
    (t: number) => {
      const s = state.current;
      const dt = Math.min(1 / 30, Math.max(0, (t - s.last) / 1000));
      s.last = t;
      const list = [...bodies.current.values()];
      let speed = 0;
      if (dt > 0) for (let k = 0; k < 2; k++) speed = step(list, dt / 2);
      paintRef.current();
      s.quiet = isQuiet(speed, maxOffset(list)) ? s.quiet + 1 : 0;
      if (s.quiet >= 18 || t - s.woke > 9000) {
        for (const b of list) snap(b);
        paintRef.current();
        raf.current = null;
        setSettled(true);
        return;
      }
      raf.current = requestAnimationFrame(tick);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const wake = useCallback(() => {
    setSettled(false);
    const s = state.current;
    s.woke = performance.now();
    s.quiet = 0;
    if (raf.current === null) {
      s.last = performance.now();
      raf.current = requestAnimationFrame(tick);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  useEffect(
    () => () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      raf.current = null;
    },
    [],
  );

  /* ---------------------------------------------------------------- targets → bodies */

  useLayoutEffect(() => {
    if (!layout || !geo) return;
    const map = bodies.current;
    const seen = new Set<string>();
    const first = state.current.first;
    state.current.first = false;
    // Bubbles that rise in are released top target first, so the stream arrives in order.
    const queue = [...layout.targets.values()].sort((a, c) => a.y - c.y);
    const slot = new Map(queue.map((t, i) => [t.id, i]));
    for (const t of layout.targets.values()) {
      seen.add(t.id);
      const b = map.get(t.id);
      if (b) {
        b.tx = t.x;
        b.ty = t.y;
        b.tr = t.r;
        b.zone = t.zone;
      } else {
        // New bubbles rise in from below the column (on first paint only when `intro`).
        const rise = !reduced && (!first || intro);
        const from = rise ? { x: t.x, y: geo.column.bottom + t.r + 24 + (slot.get(t.id) ?? 0) * 22, r: t.r * 0.5 } : undefined;
        map.set(t.id, makeBody(t, from));
      }
    }
    for (const id of [...map.keys()]) if (!seen.has(id)) map.delete(id);
    // Measure label heights for the stacking (labels are already rendered for this layout).
    for (const [id, el] of labels.current) labelH.current.set(id, el.offsetHeight);
    if (reduced) {
      for (const b of map.values()) snap(b);
      paint();
      setSettled(true);
    } else {
      paint();
      wake();
    }
    onLayout?.(layout, size);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, reduced, paint]);

  // Labels change height when focused (actions appear): re-measure after every render and restack if needed.
  useLayoutEffect(() => {
    let changed = false;
    for (const [id, el] of labels.current) {
      const h = el.offsetHeight;
      if (labelH.current.get(id) !== h) {
        labelH.current.set(id, h);
        changed = true;
      }
    }
    if (changed && raf.current === null) paint();
  });

  /* ---------------------------------------------------------------- vote bumps and answer pops */

  const prev = useRef(new Map<string, { score: number; zone: string }>());
  const [bumps, setBumps] = useState<Record<string, Bump>>({});
  const [popping, setPopping] = useState<Set<string>>(new Set());
  useEffect(() => {
    const before = prev.current;
    const nextBumps: Record<string, Bump> = {};
    const pops = new Set<string>();
    for (const b of bubbles) {
      const p = before.get(b.id);
      if (p && b.score > p.score && b.zone !== 'shelf') nextBumps[b.id] = { n: b.score - p.score, key: Date.now() };
      if (p && p.zone !== 'shelf' && b.zone === 'shelf') pops.add(b.id);
    }
    prev.current = new Map(bubbles.map((b) => [b.id, { score: b.score, zone: b.zone }]));
    if (reduced) return;
    if (Object.keys(nextBumps).length) {
      setBumps((s) => ({ ...s, ...nextBumps }));
      const t = setTimeout(() => setBumps((s) => Object.fromEntries(Object.entries(s).filter(([id]) => !(id in nextBumps)))), 1200);
      return () => clearTimeout(t);
    }
    if (pops.size) {
      setPopping(pops);
      const t = setTimeout(() => setPopping(new Set()), 560);
      return () => clearTimeout(t);
    }
  }, [bubbles, reduced]);

  /* ---------------------------------------------------------------- render */

  const shelf = layout?.shelf;
  const dock = layout?.dock;
  const col = geo?.column;
  return (
    <div ref={boxRef} className={cx('absolute inset-0 overflow-hidden', className)} data-testid="rising-column" data-settled="false">
      {col && (
        <div
          className="qa-column"
          aria-hidden="true"
          style={{ left: col.left, top: col.top, width: col.right - col.left, height: col.bottom - col.top }}
        />
      )}
      {col && dock && (
        <>
          <div aria-hidden="true" className="absolute border-t border-dashed border-[color-mix(in_oklab,var(--accent-9)_30%,transparent)]" style={{ left: col.left + 18, width: col.right - col.left - 36, top: dock.bottom }} />
          {dockCaption && (
            <div aria-hidden="true" className="x-legend-label absolute text-[10px] text-accent-11" style={{ left: col.left + 18, top: col.top + 6 }}>
              {dockCaption}
            </div>
          )}
        </>
      )}
      {col && shelf && (
        <>
          <div aria-hidden="true" className="absolute border-t border-[color-mix(in_oklab,var(--accent-9)_28%,transparent)]" style={{ left: col.left + 12, width: col.right - col.left - 24, top: shelf.top }} />
          <div aria-hidden="true" className="absolute bottom-0 rounded-b-[28px] bg-[color-mix(in_oklab,var(--accent-9)_7%,transparent)]" style={{ left: col.left, width: col.right - col.left, top: shelf.top, height: col.bottom - shelf.top }} />
          {shelfCaption && (
            <div aria-hidden="true" className="x-legend-label absolute text-[10px] text-muted" style={{ left: col.left + 16, top: shelf.top + 6 }}>
              {shelfCaption}
            </div>
          )}
        </>
      )}

      {/* Leader lines from bubbles to their labels. */}
      {sides.size > 0 && (
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full overflow-visible">
          {[...sides.keys()].map((id) => (
            <path
              key={id}
              ref={(el) => {
                if (el) leaders.current.set(id, el);
                else leaders.current.delete(id);
              }}
              fill="none"
              stroke={id === focusId ? 'var(--accent-9)' : 'color-mix(in oklab, var(--accent-9) 38%, transparent)'}
              strokeWidth={id === focusId ? 1.75 : 1.25}
              strokeDasharray={id === focusId ? undefined : '1 3'}
              strokeLinecap="round"
            />
          ))}
        </svg>
      )}

      <div role={interactive ? 'group' : undefined} aria-label={interactive ? label : undefined} aria-hidden={interactive ? undefined : true}>
        {layout &&
          ordered.map((b) => {
            const t = layout.targets.get(b.id);
            if (!t) return null;
            const R = t.r;
            const marble = b.zone === 'shelf';
            const bump = bumps[b.id];
            const cls = cx(
              'qa-bubble',
              interactive ? 'cursor-pointer' : 'pointer-events-none',
              b.dim && 'is-dim',
              b.dashed && !marble && 'is-dashed',
              mineIds?.has(b.id) && !marble && 'is-mine',
              focusId === b.id && 'is-focused',
              popping.has(b.id) && 'is-popping',
              bump && 'is-bumped',
            );
            const style = { width: 2 * R, height: 2 * R, '--qa-fill': b.fill, '--qa-ink': b.ink } as CSSProperties;
            const inner = (
              <>
                <span className="qa-face">
                  {!marble && (
                    <span className="relative z-[1] flex flex-col items-center px-1 text-center" style={{ maxWidth: 1.45 * R }}>
                      <span className="font-semibold leading-none tracking-[-0.03em] num" style={{ fontSize: countSize(R) }}>
                        {badgeFor ? badgeFor(b) : b.score}
                      </span>
                      {excerpts && R >= 50 && (
                        <span
                          className="mt-1 line-clamp-2 font-medium leading-[1.2] opacity-90"
                          style={{ fontSize: R >= 64 ? 12 : 10.5, maxWidth: 1.35 * R }}
                        >
                          {b.q.text}
                        </span>
                      )}
                    </span>
                  )}
                </span>
                {votedIds?.has(b.id) && !marble && (
                  <span
                    aria-hidden="true"
                    className="absolute right-[6%] top-[6%] grid size-[18px] place-items-center rounded-full bg-surface text-accent-11 shadow-[0_1px_3px_rgb(0_0_0/0.25)]"
                  >
                    <svg viewBox="0 0 12 12" className="size-2.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2.5 6.5 5 9l4.5-6" />
                    </svg>
                  </span>
                )}
                {b.q.isPinned && b.zone === 'dock' && (
                  <span aria-hidden="true" className="absolute left-1/2 -top-1.5 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-surface bg-accent-11 shadow-sm" />
                )}
                {bump && (
                  <span key={bump.key} aria-hidden="true">
                    <span className="qa-ripple" />
                    <span className="qa-plus">+{bump.n}</span>
                  </span>
                )}
              </>
            );
            const refFn = (el: HTMLElement | null) => {
              if (el) {
                els.current.set(b.id, el);
                const body = bodies.current.get(b.id);
                // Paint immediately so a re-render never shows a bubble at the origin.
                if (body) el.style.transform = `translate3d(${body.x - R}px, ${body.y - R}px, 0) scale(${body.r / R})`;
              } else els.current.delete(b.id);
            };
            return interactive ? (
              <button
                key={b.id}
                ref={refFn}
                type="button"
                data-r={R}
                data-id={b.id}
                data-zone={b.zone}
                data-testid="bubble"
                data-focused={focusId === b.id ? 'true' : undefined}
                aria-label={labelFor?.(b) ?? b.q.text}
                aria-current={focusId === b.id ? 'true' : undefined}
                className={cls}
                style={style}
                onClick={() => onPick?.(b.id)}
                onPointerEnter={(e) => e.pointerType === 'mouse' && onHover?.(b.id)}
                onPointerLeave={(e) => e.pointerType === 'mouse' && onHover?.(null)}
              >
                {inner}
              </button>
            ) : (
              <div key={b.id} ref={refFn} data-r={R} data-zone={b.zone} className={cls} style={style}>
                {inner}
              </div>
            );
          })}
      </div>

      {renderCallout &&
        [...sides].map(([id, side]) => {
          const b = bubbles.find((x) => x.id === id);
          if (!b) return null;
          return (
            <div
              key={id}
              ref={(el) => {
                if (el) {
                  labels.current.set(id, el);
                  labelH.current.set(id, el.offsetHeight);
                } else labels.current.delete(id);
              }}
              className="qa-callout"
              style={{ width: Math.min(geo?.calloutWidth ?? 300, ((side === 'left' ? geo?.left : geo?.right)?.right ?? 0) - ((side === 'left' ? geo?.left : geo?.right)?.left ?? 0)) }}
            >
              {renderCallout(b, side)}
            </div>
          );
        })}
    </div>
  );
}
