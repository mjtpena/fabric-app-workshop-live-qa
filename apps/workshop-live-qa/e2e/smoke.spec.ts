import { expect, test } from '@playwright/test';

import { assertNoHorizontalScroll, openApp, watchConsole } from '@x10/shared/e2e';

test('loads, creates a record, sees it listed, no console errors', async ({ page }) => {
  const consoleWatch = watchConsole(page);
  await openApp(page, '/', 'demo-ana');
  await expect(page.getByRole('heading', { name: 'Workshop Live Q&A', exact: true })).toBeVisible();
  await page.getByLabel('Session code').fill('agents');
  await page.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Designing AI Agents (demo)' })).toBeVisible();
  await page.getByLabel('Your question').fill('Smoke test: how do agents hand work to each other?');
  await page.getByRole('button', { name: 'Ask question' }).click();
  await expect(page.getByTestId('question-list').getByText('Smoke test: how do agents hand work to each other?')).toBeVisible();
  await assertNoHorizontalScroll(page);
  consoleWatch.assertClean();
});

test('host pages fit the viewport with no console errors', async ({ page }) => {
  const consoleWatch = watchConsole(page);
  await openApp(page, '/', 'demo-host');
  await expect(page.getByTestId('session-card')).toHaveCount(2);
  await assertNoHorizontalScroll(page);
  await page.getByTestId('session-card').first().getByRole('link', { name: 'Host deck' }).click();
  await expect(page.getByTestId('host-console')).toBeVisible();
  await expect(page.getByTestId('question-list').getByTestId('question-card').first()).toBeVisible();
  await assertNoHorizontalScroll(page);
  await openApp(page, '/about', 'demo-host');
  await expect(page.getByRole('heading', { name: 'About Workshop Live Q&A' })).toBeVisible();
  await assertNoHorizontalScroll(page);
  consoleWatch.assertClean();
});
