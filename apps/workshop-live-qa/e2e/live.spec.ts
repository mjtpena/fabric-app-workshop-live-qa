import { expect, test } from '@playwright/test';

import { openApp, watchConsole } from '@x10/shared/e2e';

// Acceptance 1. In demo mode two tabs of one browser profile share the local data store, standing in for two
// browser profiles sharing the Fabric SQL database.
test('a question posted in one window appears in the other within 10 seconds, behind a pill', async ({ context }) => {
  const host = await context.newPage();
  const hostConsole = watchConsole(host);
  await openApp(host, '/s/AGENTS/host', 'demo-host');
  await expect(host.getByTestId('host-console')).toBeVisible();
  const firstBefore = await host.getByTestId('question-list').getByTestId('question-text').first().innerText();

  const attendee = await context.newPage();
  await openApp(attendee, '/s/AGENTS', 'demo-ana');
  await attendee.getByLabel('Your question').fill('Live sync check: does this reach the host?');
  await attendee.getByRole('button', { name: 'Ask question' }).click();
  await expect(attendee.getByTestId('question-list').getByText('Live sync check: does this reach the host?')).toBeVisible();

  await host.bringToFront();
  const pill = host.getByTestId('new-questions-pill');
  await expect(pill).toHaveText(/1 new question/, { timeout: 10_000 });
  // The list did not jump under the reader.
  await expect(host.getByTestId('question-list').getByTestId('question-text').first()).toHaveText(firstBefore);
  await expect(host.getByText('Live sync check: does this reach the host?')).toHaveCount(0);
  await pill.click();
  await expect(host.getByText('Live sync check: does this reach the host?')).toBeVisible();
  await expect(pill).toHaveCount(0);
  hostConsole.assertClean();
});

test('an upvote from another attendee shows up on the board', async ({ context }) => {
  const ana = await context.newPage();
  await openApp(ana, '/s/AGENTS', 'demo-ana');
  const card = ana.getByTestId('question-card').filter({ hasText: 'Where should human approval sit' });
  await expect(card.getByTestId('score')).toHaveText('3');

  const chloe = await context.newPage();
  await openApp(chloe, '/s/AGENTS', 'demo-chloe');
  const chloeCard = chloe.getByTestId('question-card').filter({ hasText: 'Where should human approval sit' });
  await expect(chloeCard.getByTestId('upvote-button')).toHaveAttribute('aria-pressed', 'false');
  await chloeCard.getByTestId('upvote-button').click();
  await expect(chloeCard.getByTestId('upvote-button')).toHaveAttribute('aria-pressed', 'true');
  await expect(chloeCard.getByTestId('score')).toHaveText('4');

  await ana.bringToFront();
  await expect(card.getByTestId('score')).toHaveText('4', { timeout: 10_000 });
});
