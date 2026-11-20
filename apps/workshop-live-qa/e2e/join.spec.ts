import { expect, test } from '@playwright/test';

import { openApp } from '@x10/shared/e2e';

test('unknown and closed codes show a friendly message', async ({ page }) => {
  await openApp(page, '/join?code=ZZZZZZ', 'demo-ana');
  await expect(page.getByRole('heading', { name: 'We could not find that session' })).toBeVisible();
  await page.getByLabel('Session code').fill('LAKE25');
  await page.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(page.getByTestId('join-closed')).toContainText('has ended');
  await page.getByTestId('join-closed').getByRole('link', { name: 'See the wrap-up' }).click();
  await expect(page.getByTestId('wrapup-answered')).toBeVisible();
  await expect(page.getByTestId('wrapup-unanswered')).toContainText('Could we get the sample notebook');

  await openApp(page, '/join?code=LAKE25', 'demo-ana');
  await expect(page.getByRole('heading', { name: 'Lakehouse Modelling Basics (demo) has ended' })).toBeVisible();

  await page.getByLabel('Session code').fill('abc');
  await page.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(page.getByText('Codes are 6 letters or digits, like ABC123.')).toBeVisible();
});

test('a ?code= in the normal query string joins the session', async ({ page }) => {
  await page.goto('/?as=demo-ana&code=agents');
  await expect(page.getByRole('heading', { name: 'Designing AI Agents (demo)' })).toBeVisible();
  await expect(page).toHaveURL(/#\/s\/AGENTS$/);
  expect(page.url()).not.toContain('code=');
});
