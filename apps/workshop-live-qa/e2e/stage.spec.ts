import { expect, test, type Page } from '@playwright/test';

import { assertNoHorizontalScroll, openApp, watchConsole } from '@x10/shared/e2e';

const bubbles = (page: Page, zone?: 'dock' | 'main' | 'shelf') =>
  page.locator(zone ? `[data-testid="bubble"][data-zone="${zone}"]` : '[data-testid="bubble"]');

async function settled(page: Page) {
  await expect(page.getByTestId('rising-column')).toHaveAttribute('data-settled', 'true', { timeout: 15_000 });
}

/** The Today panel: the side panel on desktop, a bottom sheet behind the "Today" button on phones. */
async function todayPanel(page: Page) {
  const aside = page.getByRole('complementary', { name: 'Today' });
  if (await aside.isVisible()) return aside;
  await page.getByRole('button', { name: /^Today/ }).click();
  return page.getByRole('dialog');
}

// The seeded live session: 14 questions, 10 open (1 pinned, 1 parked), 3 answered, 1 hidden.
test('the rising column draws every question, re-encodes by lens and focuses from Today', async ({ page }) => {
  const consoleWatch = watchConsole(page);
  await openApp(page, '/s/AGENTS', 'demo-host');
  await settled(page);
  await expect(bubbles(page)).toHaveCount(13);
  await expect(bubbles(page, 'dock')).toHaveCount(1);
  await expect(bubbles(page, 'shelf')).toHaveCount(3);
  await expect(bubbles(page, 'dock')).toHaveAttribute('aria-label', /Pinned, 6 votes: How do you decide/);

  // Lens 3: answered questions fill the column and the open ones wait on the shelf.
  await page.keyboard.press('3');
  await expect(page.getByRole('radio', { name: /Answered/ })).toHaveAttribute('aria-checked', 'true');
  await expect(bubbles(page, 'main')).toHaveCount(3);
  await expect(bubbles(page, 'shelf')).toHaveCount(10);
  await settled(page);

  // A Today item switches back to its lens and focuses the bubble behind it.
  const today = await todayPanel(page);
  await today.getByRole('button', { name: /How do you decide when a task needs an agent/ }).click();
  await expect(page.getByRole('radio', { name: /^Top/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('[data-testid="bubble"][data-focused="true"]')).toHaveAttribute('aria-label', /How do you decide/);
  await expect(page.getByTestId('focus-card')).toContainText('How do you decide when a task needs an agent');
  await expect(page.getByTestId('focus-card').getByRole('button', { name: /Mark answered/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('focus-card')).toHaveCount(0);
  await assertNoHorizontalScroll(page);
  consoleWatch.assertClean();
});

test('the list view shows the same questions as the column', async ({ page }) => {
  await openApp(page, '/s/AGENTS', 'demo-ana');
  await settled(page);
  const n = await bubbles(page).count();
  expect(n).toBe(13);
  await page.getByRole('radio', { name: 'List' }).click();
  await expect(page.getByTestId('list-row')).toHaveCount(n);
  await expect(page.getByTestId('rising-column')).toHaveCount(0);
  await expect(page.getByTestId('list-row').first()).toContainText('How do you decide when a task needs an agent');
  // L toggles back to the column.
  await page.keyboard.press('l');
  await expect(page.getByTestId('rising-column')).toBeVisible();
  await assertNoHorizontalScroll(page);
});

test('viewing as an attendee hides what attendees cannot see', async ({ page }) => {
  await openApp(page, '/s/AGENTS', 'demo-host');
  await settled(page);
  await page.getByRole('radio', { name: 'List' }).click();
  await expect(page.getByTestId('list-row')).toHaveCount(14);
  await expect(page.getByTestId('list-row').filter({ hasText: 'SQL database directly' })).toContainText('Chloe Nguyen');
  await page.getByRole('radio', { name: /Attendee/ }).click();
  await expect(page.getByRole('radio', { name: /Attendee/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('list-row')).toHaveCount(13);
  await expect(page.getByText('standing desk')).toHaveCount(0);
  await expect(page.getByTestId('list-row').filter({ hasText: 'SQL database directly' })).toContainText('Anonymous');
});

test('an attendee upvotes from the focused bubble', async ({ page }) => {
  await openApp(page, '/s/AGENTS', 'demo-chloe');
  await settled(page);
  const target = page.locator('[data-testid="bubble"][aria-label*="human approval"]');
  await expect(target).toHaveAttribute('aria-label', /3 votes/);
  await target.click();
  const vote = page.getByTestId('focus-card').getByTestId('callout-upvote');
  await expect(vote).toHaveAttribute('aria-pressed', 'false');
  await vote.click();
  await expect(vote).toHaveAttribute('aria-pressed', 'true');
  await expect(target).toHaveAttribute('aria-label', /4 votes/);
});

test('with reduced motion and ?nowebgl the column is placed at once, without animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?as=demo-ana&nowebgl#/s/AGENTS');
  await expect(page.getByTestId('demo-banner')).toBeVisible();
  await expect(page.getByTestId('rising-column')).toHaveAttribute('data-settled', 'true', { timeout: 3_000 });
  await expect(bubbles(page)).toHaveCount(13);
  // Lens changes re-order instantly too.
  await page.keyboard.press('2');
  await expect(page.getByTestId('rising-column')).toHaveAttribute('data-settled', 'true');
  await expect(page.getByTestId('question-card').first()).toBeVisible();
});
