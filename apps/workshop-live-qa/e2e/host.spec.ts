import { expect, test } from '@playwright/test';

import { assertNoHorizontalScroll, openApp, watchConsole } from '@x10/shared/e2e';

test('the host moderates, closes the session and copies the wrap-up as Markdown', async ({ context, page }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const consoleWatch = watchConsole(page);
  await openApp(page, '/s/AGENTS/host', 'demo-host');
  await expect(page.getByTestId('kpi-participants')).toContainText('10');
  const first = page.getByTestId('question-list').getByTestId('question-card').first();
  const text = await first.getByTestId('question-text').innerText();
  await first.getByRole('button', { name: 'Mark answered' }).click();
  await expect(page.getByRole('tab', { name: 'Answered (4)' })).toBeVisible();

  // Hidden questions are moderated on their own tab.
  await page.getByRole('tab', { name: 'Hidden (1)' }).click();
  await expect(page.getByTestId('question-card')).toContainText('standing desk');

  await page.getByRole('button', { name: 'Close session' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Close session' }).click();
  await expect(page.getByTestId('wrap-up')).toBeVisible();
  await expect(page.getByTestId('wrapup-answered')).toContainText(text);
  await expect(page.getByTestId('wrapup-unanswered')).toBeVisible();
  await page.getByTestId('copy-markdown').click();
  await expect(page.getByTestId('copy-markdown')).toContainText('Copied');
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain('# Designing AI Agents (demo): Q&A wrap-up');
  expect(clip).toContain('## Answered (4)');
  expect(clip).not.toContain('standing desk');
  await assertNoHorizontalScroll(page);
  consoleWatch.assertClean();

  // Attendees now see a read-only board.
  const ana = await context.newPage();
  await openApp(ana, '/s/AGENTS', 'demo-ana');
  await expect(ana.getByTestId('closed-banner')).toBeVisible();
  await expect(ana.getByTestId('ask-box')).toHaveCount(0);
  await expect(ana.getByTestId('upvote-button')).toHaveCount(0);
});

test('an upvote on a question the host just hid is refused with a message', async ({ context }) => {
  const ana = await context.newPage();
  await ana.clock.install();
  await openApp(ana, '/s/AGENTS', 'demo-ana');
  const card = ana.getByTestId('question-card').filter({ hasText: 'cheapest way to add guardrails' });
  await expect(card).toBeVisible();

  const host = await context.newPage();
  await openApp(host, '/s/AGENTS/host', 'demo-host');
  await host
    .getByTestId('question-card')
    .filter({ hasText: 'cheapest way to add guardrails' })
    .getByRole('button', { name: 'Hide' })
    .click();
  await expect(host.getByRole('tab', { name: 'Hidden (2)' })).toBeVisible();

  await ana.bringToFront();
  await card.getByTestId('upvote-button').click();
  await expect(ana.getByRole('alert').filter({ hasText: 'The host has hidden this question' })).toBeVisible();
  await expect(card).toHaveCount(0);
});

test('a host can start a new session and sees the empty state with the join code', async ({ page }) => {
  await openApp(page, '/', 'demo-host');
  await page.getByTestId('new-session').first().click();
  await page.getByLabel('Session title').fill('Prompt Patterns Clinic');
  await page.getByRole('button', { name: 'Create session' }).click();
  await expect(page.getByRole('heading', { name: 'Prompt Patterns Clinic' })).toBeVisible();
  await expect(page.getByText('No questions yet')).toBeVisible();
  const code = (await page.getByTestId('join-code').innerText()).trim();
  expect(code).toMatch(/^[A-Z0-9]{6}$/);

  await openApp(page, `/join?code=${code}`, 'demo-ana');
  await expect(page.getByRole('heading', { name: 'Prompt Patterns Clinic' })).toBeVisible();
  await expect(page.getByText('Be the first to ask')).toBeVisible();
});
