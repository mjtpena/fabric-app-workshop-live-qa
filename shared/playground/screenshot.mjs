/**
 * Screenshots of the playground. Start it first (`npm run playground -w shared`), then:
 *   node shared/playground/screenshot.mjs [outDir] [--sections]
 * Writes catalog, shell, sign-in and boot shots at 1280×800 and 390×844, light and dark, for several accents.
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const BASE = process.env.PLAYGROUND_URL ?? 'http://localhost:5200';
const out = resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : resolve(import.meta.dirname, 'screenshots'));
const sections = process.argv.includes('--sections');
mkdirSync(out, { recursive: true });

const VIEWPORTS = { desktop: { width: 1280, height: 800 }, mobile: { width: 390, height: 844 } };
const SHOTS = [
  // [name, route, accent, theme, viewport, fullPage]
  ['catalog-indigo-light-desktop', '/', 'indigo', 'light', 'desktop', true],
  ['catalog-indigo-dark-desktop', '/', 'indigo', 'dark', 'desktop', true],
  ['catalog-ember-light-mobile', '/', 'ember', 'light', 'mobile', true],
  ['catalog-cyan-dark-mobile', '/', 'cyan', 'dark', 'mobile', true],
  ['shell-teal-light-desktop', '/shell', 'teal', 'light', 'desktop', false],
  ['shell-teal-dark-desktop', '/shell', 'teal', 'dark', 'desktop', false],
  ['shell-amber-light-mobile', '/shell', 'amber', 'light', 'mobile', true],
  ['shell-violet-dark-mobile', '/shell', 'violet', 'dark', 'mobile', true],
  ['signin-teal-light-desktop', '/signin?error=1', 'teal', 'light', 'desktop', false],
  ['signin-plum-dark-mobile', '/signin', 'plum', 'dark', 'mobile', false],
  ['boot-gold-light-desktop', '/boot', 'gold', 'light', 'desktop', false],
  ['stage-ember-light-desktop', '/stage', 'ember', 'light', 'desktop', false],
  ['stage-cyan-dark-desktop', '/stage', 'cyan', 'dark', 'desktop', false],
  ['stage-violet-light-mobile', '/stage', 'violet', 'light', 'mobile', true],
  ['stage-teal-dark-mobile', '/stage', 'teal', 'dark', 'mobile', true],
  ['stage-nowebgl-plum-light-desktop', '/stage-nowebgl', 'plum', 'light', 'desktop', false],
  ['catalog-stagekit-gold-light-desktop', '/', 'gold', 'light', 'desktop', false, '#stage'],
  ['catalog-stagekit-indigo-dark-desktop', '/', 'indigo', 'dark', 'desktop', false, '#stage'],
];

const browser = await chromium.launch();
const errors = [];
const external = new Set();
for (const [name, route, accent, theme, vp, full, anchor] of SHOTS) {
  const ctx = await browser.newContext({ viewport: VIEWPORTS[vp], deviceScaleFactor: 1, colorScheme: theme });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${name}: ${m.text()}`));
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (!['localhost', '127.0.0.1'].includes(u.hostname) && u.protocol.startsWith('http')) external.add(r.url());
  });
  const [path, query] = route.split('?');
  const q = new URLSearchParams(query);
  q.set('accent', accent);
  q.set('theme', theme);
  await page.goto(`${BASE}/?${q}#${path}`);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  if (anchor) {
    await page.locator(anchor).scrollIntoViewIfNeeded();
    await page.evaluate((a) => document.querySelector(a)?.scrollIntoView({ block: 'start' }), anchor);
    await page.mouse.wheel(0, -70);
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: resolve(out, `${name}.png`), fullPage: full });
  if (sections && path === '/') {
    for (const el of await page.locator('[data-block]').all()) {
      const id = await el.getAttribute('data-block');
      await el.screenshot({ path: resolve(out, `${name}--${id}.png`) });
    }
  }
  await ctx.close();
}

// Stage interactions: focus from Today (desktop), list view, the Today sheet on phones.
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: VIEWPORTS.desktop, colorScheme: theme });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`stage ${theme}: ${e.message}`));
  await page.goto(`${BASE}/?accent=ember&theme=${theme}#/stage`);
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('button', { name: /stalest/ }).click();
  await page.keyboard.press('2');
  await page.waitForTimeout(400);
  await page.screenshot({ path: resolve(out, `stage-focus-lens2-${theme}-desktop.png`) });
  await page.keyboard.press('l');
  await page.waitForTimeout(300);
  await page.screenshot({ path: resolve(out, `stage-list-${theme}-desktop.png`) });
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: VIEWPORTS.mobile, colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?accent=ember&theme=light#/stage`);
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('button', { name: /^Today/ }).click();
  await page.waitForTimeout(450);
  await page.screenshot({ path: resolve(out, 'stage-today-sheet-light-mobile.png') });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) errors.push(`stage mobile: horizontal overflow ${overflow}px`);
  await ctx.close();
}

// Open overlays once, desktop and mobile.
for (const vp of ['desktop', 'mobile']) {
  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: VIEWPORTS[vp], colorScheme: theme });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`overlays ${vp}: ${e.message}`));
    await page.goto(`${BASE}/?accent=violet&theme=${theme}#/`);
    await page.evaluate(() => document.fonts.ready);
    await page.locator('#overlays').scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: 'Actions' }).click();
    await page.waitForTimeout(250);
    await page.screenshot({ path: resolve(out, `overlay-menu-${theme}-${vp}.png`) });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Score breakdown' }).click();
    await page.waitForTimeout(250);
    await page.screenshot({ path: resolve(out, `overlay-popover-${theme}-${vp}.png`) });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Dialog', exact: true }).click();
    await page.waitForTimeout(350);
    await page.screenshot({ path: resolve(out, `overlay-dialog-${theme}-${vp}.png`) });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Toast with Undo' }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: resolve(out, `overlay-toast-${theme}-${vp}.png`) });
    // Shell identity menu
    await page.goto(`${BASE}/?accent=teal&theme=${theme}#/shell`);
    await page.getByTestId('identity-button').click();
    await page.waitForTimeout(250);
    await page.screenshot({ path: resolve(out, `shell-identity-menu-${theme}-${vp}.png`) });
    if (vp === 'mobile') {
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'More' }).click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: resolve(out, `shell-more-sheet-${theme}-${vp}.png`) });
    }
    await ctx.close();
  }
}
await browser.close();

console.log(`screenshots in ${out}`);
if (external.size) console.log('EXTERNAL REQUESTS:\n' + [...external].join('\n'));
else console.log('no external requests');
if (errors.length) {
  console.log('ERRORS:\n' + errors.join('\n'));
  process.exitCode = 1;
}
