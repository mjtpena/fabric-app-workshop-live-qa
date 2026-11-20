import { expect, test } from '@playwright/test';
import QRCode from 'qrcode';

import { assertNoHorizontalScroll, watchConsole } from '@x10/shared/e2e';

/** The module path of a qrcode SVG (the dark-stroke path's `d`). */
function modules(svg: string): string | undefined {
  const path = /<path[^>]*stroke="#000000"[^>]*>/.exec(svg)?.[0];
  return path ? /\sd="([^"]+)"/.exec(path)?.[1] : undefined;
}

// Acceptance 4.
test('big screen shows the top 5, the code and a working join QR, with no app chrome or controls', async ({ page, baseURL }) => {
  const consoleWatch = watchConsole(page);
  await page.goto('/?as=demo-host#/s/AGENTS/screen');
  const screen = page.getByTestId('big-screen');
  await expect(screen.getByTestId('screen-question')).toHaveCount(5);
  await expect(screen.getByTestId('screen-question').first()).toContainText('How do you decide when a task needs an agent');
  await expect(screen.getByTestId('join-code')).toHaveText('AGENTS');
  await expect(page.getByTestId('demo-banner')).toHaveCount(0);
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await expect(page.getByRole('button')).toHaveCount(0);
  await expect(page.getByRole('link')).toHaveCount(0);

  const qr = page.getByTestId('join-qr');
  await expect(qr).toHaveAttribute('data-ready', 'true');
  const url = await qr.getAttribute('data-join-url');
  expect(url).toBe(`${baseURL}/#/join?code=AGENTS`);
  // The rendered modules are exactly the QR encoding of that link.
  const expected = await QRCode.toString(url!, {
    type: 'svg',
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  });
  const rendered = modules(await qr.innerHTML());
  expect(rendered).toBeTruthy();
  expect(rendered).toBe(modules(expected));
  const box = await qr.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(200);
  await assertNoHorizontalScroll(page);
  consoleWatch.assertClean();

  // Following the link (as an attendee) lands on the session board.
  await page.goto(url!.replace('/#/', '/?as=demo-ana#/'));
  await expect(page.getByRole('heading', { name: 'Designing AI Agents (demo)' })).toBeVisible();
  await expect(page.getByTestId('ask-box')).toBeVisible();
});
