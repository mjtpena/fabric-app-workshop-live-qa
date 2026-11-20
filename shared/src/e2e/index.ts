/**
 * Playwright helpers for the per-app smoke tests. Import only from e2e specs (Node), never from app code.
 */
import { expect, type Page } from '@playwright/test';

/** Collect console errors and page errors; call `assertClean()` at the end of the test. */
export function watchConsole(page: Page) {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return {
    errors,
    assertClean() {
      expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
    },
  };
}

/** Open the app in demo mode as a persona, with fresh data. */
export async function openApp(page: Page, path = '/', persona?: string) {
  const q = persona ? `?as=${encodeURIComponent(persona)}` : '';
  await page.goto(`/${q}#${path}`);
  await expect(page.getByTestId('demo-banner')).toBeVisible();
}

/** Fail if the page scrolls horizontally (layout broken at narrow widths). */
export async function assertNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'page should not scroll horizontally').toBeLessThanOrEqual(1);
}

export const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 800 },
] as const;
