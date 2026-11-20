/**
 * Colour ramps for the design system, generated in OKLCH and solved for WCAG AA.
 *
 * Every hue gets a 12-step ramp per theme with Radix-style semantics:
 *   1–2 app backgrounds · 3–5 component backgrounds (normal, hover, pressed) · 6–8 borders
 *   9 solid · 10 solid hover · 11 low-contrast text · 12 high-contrast text
 * plus a `contrast` colour for text on the solid (white or a deep tint).
 *
 * `scripts/gen-palette.ts` writes `palette.css` from this file; `palette.test.ts` asserts the AA pairs.
 * No DOM or React here: it runs in Node and in Vitest.
 */

export const ACCENTS = ['indigo', 'ember', 'blue', 'plum', 'amber', 'violet', 'coral', 'teal', 'gold', 'cyan'] as const;
export type AccentName = (typeof ACCENTS)[number];

/** Hues used by status colours (ok = green, warn = amber, bad = red, info = blue). */
export const STATUS_HUES = { ok: 'green', warn: 'amber', bad: 'red', info: 'blue' } as const;

export interface HueSpec {
  name: string;
  /** OKLCH hue angle. */
  h: number;
  /** Peak chroma (at the solid step). Clipped to the sRGB gamut per step. */
  c: number;
  /** Target lightness of the solid (step 9); moved until the solid/contrast pair passes AA. */
  solidL: number;
  /** Text on the solid: white, or a deep tint of the same hue (bright hues such as amber, gold, cyan). */
  on: 'white' | 'dark';
  /** Dark theme only: scale chroma (dark mode softens accents slightly). */
  darkChroma?: number;
}

export const HUES: HueSpec[] = [
  { name: 'gray', h: 84, c: 0.008, solidL: 0.64, on: 'white' }, // warm stone neutral: soft paper, crisp ink
  { name: 'indigo', h: 274, c: 0.2, solidL: 0.53, on: 'white' },
  { name: 'ember', h: 34, c: 0.2, solidL: 0.58, on: 'white' },
  { name: 'blue', h: 258, c: 0.19, solidL: 0.5, on: 'white' },
  { name: 'plum', h: 338, c: 0.15, solidL: 0.47, on: 'white' },
  { name: 'amber', h: 72, c: 0.17, solidL: 0.8, on: 'dark' },
  { name: 'violet', h: 293, c: 0.24, solidL: 0.53, on: 'white' },
  { name: 'coral', h: 24, c: 0.16, solidL: 0.69, on: 'dark' },
  { name: 'teal', h: 182, c: 0.12, solidL: 0.53, on: 'white' },
  { name: 'gold', h: 88, c: 0.13, solidL: 0.74, on: 'dark' },
  { name: 'cyan', h: 214, c: 0.13, solidL: 0.75, on: 'dark' },
  { name: 'green', h: 152, c: 0.15, solidL: 0.53, on: 'white' },
  { name: 'red', h: 25, c: 0.21, solidL: 0.55, on: 'white' },
];

/* ------------------------------------------------------------------ colour maths */

type RGB = [number, number, number];

function oklchToLinear(L: number, C: number, H: number): RGB {
  const hr = (H * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (rgb: RGB) => rgb.every((v) => v >= -0.0005 && v <= 1.0005);

const encode = (v: number) => {
  const c = Math.min(1, Math.max(0, v));
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
};

/** OKLCH to hex, reducing chroma until the colour fits in sRGB. */
export function oklchToHex(L: number, C: number, H: number): string {
  let c = C;
  let rgb = oklchToLinear(L, c, H);
  if (!inGamut(rgb)) {
    let lo = 0;
    let hi = C;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinear(L, mid, H))) lo = mid;
      else hi = mid;
    }
    c = lo;
    rgb = oklchToLinear(L, c, H);
  }
  return (
    '#' +
    rgb
      .map((v) =>
        Math.round(encode(v) * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/* ------------------------------------------------------------------ ramps */

export interface Ramp {
  name: string;
  steps: string[]; // 12 hex values, index 0 = step 1
  contrast: string; // text on step 9 / 10
}

export interface Palette {
  light: Ramp[];
  dark: Ramp[];
}

const LIGHT_L = [0.994, 0.982, 0.961, 0.938, 0.91, 0.875, 0.826, 0.755];
const LIGHT_CF = [0.012, 0.03, 0.075, 0.13, 0.19, 0.26, 0.36, 0.52];
const DARK_L = [0.178, 0.206, 0.255, 0.288, 0.322, 0.365, 0.425, 0.515];
const DARK_CF = [0.03, 0.055, 0.17, 0.25, 0.3, 0.36, 0.44, 0.58];

const GRAY_LIGHT_L = [0.991, 0.979, 0.956, 0.935, 0.91, 0.885, 0.85, 0.79, 0.645, 0.61, 0.505, 0.235];
const GRAY_DARK_L = [0.182, 0.21, 0.245, 0.276, 0.307, 0.345, 0.405, 0.49, 0.545, 0.59, 0.775, 0.945];
const GRAY_LIGHT_C = [0.0025, 0.004, 0.005, 0.006, 0.0065, 0.007, 0.008, 0.009, 0.01, 0.01, 0.009, 0.007];
const GRAY_DARK_C = [0.003, 0.0035, 0.004, 0.0045, 0.005, 0.0055, 0.006, 0.007, 0.008, 0.008, 0.007, 0.004];

const WHITE = '#ffffff';
const AA = 4.5;
const MARGIN = 4.6;

function gray(theme: 'light' | 'dark'): Ramp {
  const spec = HUES[0];
  const Ls = theme === 'light' ? GRAY_LIGHT_L : GRAY_DARK_L;
  const Cs = theme === 'light' ? GRAY_LIGHT_C : GRAY_DARK_C;
  const steps = Ls.map((L, i) => oklchToHex(L, Cs[i], spec.h));
  return { name: 'gray', steps, contrast: WHITE };
}

/** Background steps the text steps must read on. */
function textBackgrounds(steps: string[], g: Ramp, theme: 'light' | 'dark'): string[] {
  return theme === 'light'
    ? [WHITE, g.steps[0], g.steps[1], steps[0], steps[1], steps[2], steps[3]]
    : [g.steps[0], g.steps[1], g.steps[2], steps[0], steps[1], steps[2], steps[3]];
}

function ramp(spec: HueSpec, theme: 'light' | 'dark', g: Ramp): Ramp {
  const cf = theme === 'dark' ? (spec.darkChroma ?? 0.92) : 1;
  const C = spec.c * cf;
  const Ls = theme === 'light' ? LIGHT_L : DARK_L;
  const CF = theme === 'light' ? LIGHT_CF : DARK_CF;
  const steps: string[] = Ls.map((L, i) => oklchToHex(L, C * CF[i], spec.h));

  // Text on the solid: white or a deep tint.
  const deep = oklchToHex(0.22, Math.min(C, 0.06), spec.h);
  const on = spec.on === 'white' ? WHITE : deep;

  // Solid (9) and hover (10). Move lightness until both pass AA with `on`.
  const hoverDelta = theme === 'light' ? -0.035 : 0.03;
  let L9 = spec.solidL;
  const dir = spec.on === 'white' ? -1 : 1;
  for (let i = 0; i < 80; i++) {
    const s9 = oklchToHex(L9, C, spec.h);
    const s10 = oklchToHex(L9 + (spec.on === 'white' ? hoverDelta : -Math.abs(hoverDelta)), C, spec.h);
    if (contrast(s9, on) >= MARGIN && contrast(s10, on) >= MARGIN) break;
    L9 += dir * 0.005;
  }
  const s9 = oklchToHex(L9, C, spec.h);
  const s10 = oklchToHex(L9 + (spec.on === 'white' ? hoverDelta : -Math.abs(hoverDelta)), C, spec.h);

  // Text (11): the lightest (light theme) or darkest (dark theme) value that passes on every background.
  const bgs = textBackgrounds(steps, g, theme);
  let L11 = theme === 'light' ? 0.62 : 0.77;
  const c11 = C * (theme === 'light' ? 0.85 : 0.8);
  for (let i = 0; i < 120; i++) {
    const t = oklchToHex(L11, c11, spec.h);
    if (bgs.every((b) => contrast(t, b) >= MARGIN)) break;
    L11 += theme === 'light' ? -0.004 : 0.004;
  }
  const s11 = oklchToHex(L11, c11, spec.h);
  const s12 = theme === 'light' ? oklchToHex(0.3, C * 0.38, spec.h) : oklchToHex(0.935, C * 0.2, spec.h);

  return { name: spec.name, steps: [...steps, s9, s10, s11, s12], contrast: on };
}

export function buildPalette(): Palette {
  const gl = gray('light');
  const gd = gray('dark');
  return {
    light: [gl, ...HUES.slice(1).map((h) => ramp(h, 'light', gl))],
    dark: [gd, ...HUES.slice(1).map((h) => ramp(h, 'dark', gd))],
  };
}

/* ------------------------------------------------------------------ checks */

export interface ContrastCheck {
  theme: 'light' | 'dark';
  ramp: string;
  pair: string;
  ratio: number;
}

/** Every text/background pair the kit relies on. All must be >= 4.5. */
export function contrastChecks(p: Palette = buildPalette()): ContrastCheck[] {
  const out: ContrastCheck[] = [];
  for (const theme of ['light', 'dark'] as const) {
    const ramps = p[theme];
    const g = ramps[0];
    const surface = theme === 'light' ? WHITE : g.steps[1];
    for (const r of ramps) {
      const add = (pair: string, a: string, b: string) =>
        out.push({ theme, ramp: r.name, pair, ratio: Math.round(contrast(a, b) * 100) / 100 });
      add('11 on surface', r.steps[10], surface);
      add('11 on gray-1', r.steps[10], g.steps[0]);
      add('11 on 3', r.steps[10], r.steps[2]);
      add('11 on 4', r.steps[10], r.steps[3]);
      add('12 on 3', r.steps[11], r.steps[2]);
      add('12 on surface', r.steps[11], surface);
      if (r.name === 'gray') continue; // gray-9/10 are neutral indicators, never a text background
      add('contrast on 9', r.contrast, r.steps[8]);
      add('contrast on 10', r.contrast, r.steps[9]);
    }
  }
  return out;
}

export { AA as AA_MIN };

/** Categorical chart order after the accent. Status hues (green, red) are kept for meaning, not categories. */
export const CHART_ORDER = ['blue', 'amber', 'teal', 'violet', 'coral', 'cyan', 'plum', 'gold', 'indigo', 'ember'];

/** Pick five categorical companions for an accent, skipping hues too close to it. */
export function chartCompanions(accent: string): string[] {
  const hueOf = (n: string) => HUES.find((h) => h.name === n)?.h ?? 0;
  const dist = (a: number, b: number) => {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  };
  const ah = hueOf(accent);
  const picked: string[] = [];
  for (const n of CHART_ORDER) {
    if (n === accent) continue;
    if (dist(hueOf(n), ah) < 28) continue;
    if (picked.some((p) => dist(hueOf(p), hueOf(n)) < 28)) continue;
    picked.push(n);
    if (picked.length === 5) break;
  }
  return picked;
}
