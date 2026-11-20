import { expect, test } from '@playwright/test';

import { openApp } from '@x10/shared/e2e';

// Acceptance 2. Ben starts with 4 unanswered questions in the seeded session.
test('the fifth unanswered question is accepted and the sixth is refused with a clear message', async ({ page }) => {
  await openApp(page, '/s/AGENTS', 'demo-ben');
  await expect(page.getByTestId('open-count')).toHaveText('4 of 5 unanswered questions used');
  await page.getByLabel('Your question').fill('Fifth question: how do agents share context safely?');
  await page.getByRole('button', { name: 'Ask question' }).click();
  await expect(page.getByTestId('question-list').getByText('Fifth question: how do agents share context safely?')).toBeVisible();
  await expect(page.getByTestId('open-count')).toHaveText('5 of 5 unanswered questions used');
  await page.getByLabel('Your question').fill('Sixth question that should be refused');
  await expect(page.getByTestId('limit-message')).toContainText('You already have 5 unanswered questions');
  await expect(page.getByRole('button', { name: 'Ask question' })).toBeDisabled();
});

test('the limit is re-checked just before insert, even from a stale screen', async ({ context }) => {
  // This tab never polls (frozen timers), so its screen still says 4 of 5.
  const stale = await context.newPage();
  await stale.clock.install();
  await openApp(stale, '/s/AGENTS', 'demo-ben');
  await expect(stale.getByTestId('open-count')).toHaveText('4 of 5 unanswered questions used');

  const other = await context.newPage();
  await openApp(other, '/s/AGENTS', 'demo-ben');
  await other.getByLabel('Your question').fill('Fifth question asked from another tab');
  await other.getByRole('button', { name: 'Ask question' }).click();
  await expect(other.getByTestId('limit-message')).toBeVisible();

  await stale.bringToFront();
  await stale.getByLabel('Your question').fill('Sixth question from the stale tab');
  await stale.getByRole('button', { name: 'Ask question' }).click();
  await expect(stale.getByRole('alert').filter({ hasText: 'You already have 5 unanswered questions' })).toBeVisible();
  await expect(stale.getByTestId('question-list').getByText('Sixth question from the stale tab')).toHaveCount(0);
  // The refused draft stays in the box so nothing typed is lost.
  await expect(stale.getByLabel('Your question')).toHaveValue('Sixth question from the stale tab');
});
