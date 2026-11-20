import { expect, test } from '@playwright/test';

import { openApp } from '@x10/shared/e2e';

const TEXT = 'Anonymous e2e question: is it fine to ask this?';

// Acceptance 3.
test('anonymous questions are anonymous in attendee views and named in the host console', async ({ context }) => {
  const chloe = await context.newPage();
  await openApp(chloe, '/s/AGENTS', 'demo-chloe');
  await chloe.getByLabel('Your question').fill(TEXT);
  await chloe.getByLabel('Ask anonymously').check();
  await chloe.getByRole('button', { name: 'Ask question' }).click();
  const own = chloe.getByTestId('question-card').filter({ hasText: TEXT });
  await expect(own.getByTestId('question-author')).toHaveText('Anonymous (you)');

  const ana = await context.newPage();
  await openApp(ana, '/s/AGENTS', 'demo-ana');
  const seen = ana.getByTestId('question-card').filter({ hasText: TEXT });
  await expect(seen.getByTestId('question-author')).toHaveText('Anonymous');
  await expect(ana.getByTestId('question-list').getByText('Chloe Nguyen')).toHaveCount(0);

  const host = await context.newPage();
  await openApp(host, '/s/AGENTS/host', 'demo-host');
  const named = host.getByTestId('question-card').filter({ hasText: TEXT });
  await expect(named.getByTestId('question-author')).toHaveText('Chloe Nguyen');
  await expect(named.getByText('Anonymous to attendees')).toBeVisible();

  // The Markdown export stays anonymous, even when the host opens it.
  await openApp(host, '/s/AGENTS/wrap-up', 'demo-host');
  await expect(host.getByTestId('wrapup-markdown')).toContainText(`${TEXT} — Anonymous`);
});
