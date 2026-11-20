import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ACCENTS, AA_MIN, buildPalette, chartCompanions, contrastChecks, contrast } from './palette';

describe('palette', () => {
  it('passes WCAG AA for every text/solid pair in both themes', () => {
    const failing = contrastChecks().filter((c) => c.ratio < AA_MIN);
    expect(failing).toEqual([]);
  });

  it('has 12 steps for gray, every accent and the status hues', () => {
    const p = buildPalette();
    for (const theme of ['light', 'dark'] as const) {
      const names = p[theme].map((r) => r.name);
      for (const n of ['gray', ...ACCENTS, 'green', 'red']) expect(names).toContain(n);
      for (const r of p[theme]) expect(r.steps).toHaveLength(12);
    }
  });

  it('keeps body text readable on page and panel backgrounds', () => {
    const { light, dark } = buildPalette();
    expect(contrast(light[0].steps[11], '#ffffff')).toBeGreaterThan(12);
    expect(contrast(dark[0].steps[11], dark[0].steps[1])).toBeGreaterThan(12);
  });

  it('gives each accent five distinct chart companions', () => {
    for (const a of ACCENTS) {
      const c = chartCompanions(a);
      expect(c).toHaveLength(5);
      expect(c).not.toContain(a);
    }
  });

  it('palette.css is up to date with palette.ts', () => {
    const css = readFileSync(resolve(__dirname, 'palette.css'), 'utf8');
    const { light } = buildPalette();
    for (const r of light) expect(css).toContain(`--${r.name}-9: ${r.steps[8]};`);
  });
});
