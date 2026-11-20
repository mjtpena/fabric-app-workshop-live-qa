import { expect, test } from '@playwright/test';

import { assertNoHorizontalScroll, openApp, watchConsole } from '@x10/shared/e2e';

test('loads, creates a record, sees it listed, no console errors', async ({ page }) => {
  const consoleWatch = watchConsole(page);
  await openApp(page, '/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();
  await page.getByLabel('Title').fill('Smoke test note');
  await page.getByRole('button', { name: 'Add note' }).click();
  await expect(page.getByText('Smoke test note')).toBeVisible();
  await assertNoHorizontalScroll(page);
  consoleWatch.assertClean();
});
