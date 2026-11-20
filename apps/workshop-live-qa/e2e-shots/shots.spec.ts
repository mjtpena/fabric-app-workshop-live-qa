import { expect, test, type Page } from '@playwright/test';

const DIR = process.env.SHOTS_DIR ?? 'docs/redesign';
const ONLY = process.env.SHOTS_ONLY; // e.g. "board" to iterate on one screen

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'phone', width: 390, height: 844 },
] as const;
const SCHEMES = ['light', 'dark'] as const;

async function open(page: Page, path: string, as = 'demo-host') {
  await page.goto(`/?as=${as}#${path}`);
}

async function settled(page: Page) {
  await expect(page.getByTestId('rising-column').first()).toHaveAttribute('data-settled', 'true', { timeout: 15_000 });
  await page.waitForTimeout(250);
}

for (const vp of VIEWPORTS) {
  for (const scheme of SCHEMES) {
    test.describe(`${vp.name} ${scheme}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height }, colorScheme: scheme });
      const name = (n: string) => `${DIR}/${n}-${scheme}-${vp.name}.png`;
      const want = (n: string) => !ONLY || n.startsWith(ONLY);

      test('board', async ({ page }) => {
        test.skip(!want('board'));
        await open(page, '/s/AGENTS');
        await settled(page);
        await page.screenshot({ path: name('board-top') });
        await page.keyboard.press('2');
        await settled(page);
        await page.screenshot({ path: name('board-newest') });
        await page.keyboard.press('3');
        await settled(page);
        await page.screenshot({ path: name('board-answered') });
        await page.keyboard.press('1');
        if (vp.name === 'phone') await page.getByRole('button', { name: /^Today/ }).click();
        const today = vp.name === 'phone' ? page.getByRole('dialog') : page.getByRole('complementary', { name: 'Today' });
        await today.getByRole('button', { name: /needs an agent/ }).click();
        await settled(page);
        await page.screenshot({ path: name('board-focus') });
        await page.keyboard.press('Escape');
        await page.getByRole('radio', { name: 'List' }).click();
        await page.waitForTimeout(200);
        await page.screenshot({ path: name('board-list'), fullPage: vp.name === 'phone' });
      });

      test('board attendee', async ({ page }) => {
        test.skip(!want('attendee'));
        await open(page, '/s/AGENTS', 'demo-ana');
        await settled(page);
        await page.screenshot({ path: name('attendee-board') });
        if (vp.name === 'phone') await page.screenshot({ path: name('attendee-board-full'), fullPage: true });
      });

      test('deck', async ({ page }) => {
        test.skip(!want('deck'));
        await open(page, '/s/AGENTS/host');
        await expect(page.getByTestId('host-console')).toBeVisible();
        await page.waitForTimeout(300);
        await page.screenshot({ path: name('host-deck'), fullPage: vp.name === 'phone' });
      });

      test('screen', async ({ page }) => {
        test.skip(!want('screen'));
        await open(page, '/s/AGENTS/screen');
        await expect(page.getByTestId('join-qr')).toHaveAttribute('data-ready', 'true');
        if (vp.name === 'desktop') await settled(page);
        await page.waitForTimeout(600);
        await page.screenshot({ path: name('big-screen'), fullPage: vp.name === 'phone' });
      });

      test('wrap-up', async ({ page }) => {
        test.skip(!want('wrap'));
        await open(page, '/s/LAKE25/wrap-up');
        await expect(page.getByTestId('wrap-up')).toBeVisible();
        await page.screenshot({ path: name('wrap-up'), fullPage: true });
      });

      test('hub', async ({ page }) => {
        test.skip(!want('hub'));
        await open(page, '/');
        await expect(page.getByTestId('session-card').first()).toBeVisible();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: name('sessions-host'), fullPage: true });
        await open(page, '/', 'demo-ana');
        await page.screenshot({ path: name('sessions-attendee'), fullPage: true });
        await open(page, '/join?code=ZZZZZZ', 'demo-ana');
        await expect(page.getByTestId('join-message')).toBeVisible();
        await page.screenshot({ path: name('join-unknown') });
        await open(page, '/about');
        await page.screenshot({ path: name('about'), fullPage: true });
      });
    });
  }
}
