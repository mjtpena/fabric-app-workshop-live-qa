/**
 * Small hooks and helpers for centrepieces: hotkeys, reduced motion, media queries, WebGL detection and concrete
 * theme colours for canvas / WebGL renderers (which cannot read CSS variables).
 */
import { useEffect, useRef, useState } from 'react';

/* ------------------------------------------------------------------ media */

export function useMediaQuery(query: string, fallback = false): boolean {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : fallback);
  const [m, setM] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(query);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, [query]);
  return m;
}

/** True from the md breakpoint (768px) up: the immersive desktop layout. */
export function useIsDesktop() {
  return useMediaQuery('(min-width: 768px)', true);
}

/** True when the user asked for reduced motion. Centrepieces should stop camera flights, physics and loops. */
export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/* ------------------------------------------------------------------ WebGL */

let webgl: boolean | null = null;

/** Whether WebGL (2 or 1) is available. Cached. Render the SVG/list fallback when false. `?nowebgl` forces false. */
export function supportsWebGL(): boolean {
  if (webgl !== null) return webgl;
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return (webgl = false);
    if (/[?&#]nowebgl\b/.test(window.location.href)) return (webgl = false);
    const c = document.createElement('canvas');
    webgl = !!(c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl'));
  } catch {
    webgl = false;
  }
  return webgl;
}

/* ------------------------------------------------------------------ hotkeys */

export type HotkeyHandler = (e: KeyboardEvent) => void;

/**
 * Keyboard shortcuts. Keys: '1', 'k', 'shift+?', 'mod+k' (Ctrl or ⌘), 'escape', 'arrowleft'. Ignored while typing in
 * inputs, textareas, selects and contenteditable (unless `allowInInputs`), and while a modal dialog is open (unless
 * `allowInDialogs`). Handlers can change every render; listeners are bound once.
 *   useHotkeys({ k: () => vote('keep'), x: () => vote('kill'), '/': focusSearch });
 */
export function useHotkeys(
  map: Record<string, HotkeyHandler | undefined | false>,
  options: { enabled?: boolean; allowInInputs?: boolean; allowInDialogs?: boolean } = {},
) {
  const ref = useRef(map);
  ref.current = map;
  const { enabled = true, allowInInputs = false, allowInDialogs = false } = options;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      const t = e.target as HTMLElement | null;
      if (!allowInInputs && t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (!allowInDialogs && document.querySelector('dialog[open]')) return;
      const key = e.key.toLowerCase();
      for (const [combo, fn] of Object.entries(ref.current)) {
        if (!fn) continue;
        const parts = combo.toLowerCase().split('+');
        const k = parts[parts.length - 1];
        const mod = parts.includes('mod');
        const shift = parts.includes('shift');
        const alt = parts.includes('alt');
        if (k !== key) continue;
        if (mod !== (e.ctrlKey || e.metaKey)) continue;
        if (alt !== e.altKey) continue;
        // Shift is implied by characters such as '?'; only enforce it when asked for.
        if (shift && !e.shiftKey) continue;
        e.preventDefault();
        fn(e);
        return;
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [enabled, allowInInputs, allowInDialogs]);
}

/* ------------------------------------------------------------------ theme colours for renderers */

export const WORLD_TOKENS = [
  'sky',
  'sky-2',
  'haze',
  'ground',
  'ground-2',
  'structure',
  'structure-2',
  'water',
  'water-2',
  'foliage',
  'foliage-2',
  'glow',
  'ink',
  'ink-muted',
  'grid',
  'shadow',
] as const;
export type WorldToken = (typeof WORLD_TOKENS)[number];

export interface ThemeColors {
  dark: boolean;
  world: Record<WorldToken, string>;
  /** accent[1..12] (index 0 unused) */
  accent: string[];
  gray: string[];
  ok: string;
  warn: string;
  bad: string;
  info: string;
  text: string;
  muted: string;
  surface: string;
  line: string;
}

/** Read a CSS custom property from <html> (resolved value). */
export function cssVar(name: string, el?: Element): string {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(el ?? document.documentElement).getPropertyValue(name).trim();
}

function readTheme(): ThemeColors {
  const world = Object.fromEntries(WORLD_TOKENS.map((t) => [t, cssVar(`--world-${t}`)])) as Record<WorldToken, string>;
  const ramp = (n: string) => ['', ...Array.from({ length: 12 }, (_, i) => cssVar(`--${n}-${i + 1}`))];
  const root = typeof document !== 'undefined' ? document.documentElement : null;
  const forced = root?.dataset.theme;
  const dark =
    forced === 'dark' || (forced !== 'light' && typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  return {
    dark,
    world,
    accent: ramp('accent'),
    gray: ramp('gray'),
    ok: cssVar('--ok-solid'),
    warn: cssVar('--warn-solid'),
    bad: cssVar('--bad-solid'),
    info: cssVar('--info-solid'),
    text: cssVar('--text'),
    muted: cssVar('--muted'),
    surface: cssVar('--surface'),
    line: cssVar('--line'),
  };
}

/**
 * Concrete theme colours (world, accent and gray ramps, status) for canvas, SVG filters and three.js materials.
 * Re-reads when the theme (system or data-theme) or the accent changes.
 */
export function useThemeColors(): ThemeColors {
  const [c, setC] = useState(readTheme);
  useEffect(() => {
    const on = () => setC(readTheme());
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    mq?.addEventListener?.('change', on);
    const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(on) : null;
    mo?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-accent'] });
    return () => {
      mq?.removeEventListener?.('change', on);
      mo?.disconnect();
    };
  }, []);
  return c;
}
