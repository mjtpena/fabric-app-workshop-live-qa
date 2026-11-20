import type { DemoHelpers, DemoScript } from '@x10/shared/demo';

const STORAGE_KEY = 'x10:workshop-live-qa:data:v1';

/**
 * Simulate another attendee asking from their own device: write a question straight into the demo store
 * (the same localStorage-backed store every demo tab reads), so the open host deck picks it up on its next poll.
 */
async function anotherAttendeeAsks(h: DemoHelpers, text: string) {
  await h.page.evaluate(
    ({ key, text: t }) => {
      type Row = Record<string, unknown>;
      const db = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, Row[]>;
      const session = (db.QaSession ?? []).find((s) => s.code === 'AGENTS');
      if (!session) return;
      db.Question = [
        ...(db.Question ?? []),
        {
          id: crypto.randomUUID(),
          sessionId: session.id,
          text: t,
          authorSub: 'seed-attendee-2',
          authorName: 'Omar Haddad',
          isAnonymous: false,
          isPinned: false,
          status: 'new',
          hostSub: session.hostSub,
          createdAt: new Date().toISOString(),
          answeredAt: null,
        },
      ];
      localStorage.setItem(key, JSON.stringify(db));
    },
    { key: STORAGE_KEY, text },
  );
}

/** Wait until the bubbles in the column have come to rest. */
async function settled(h: DemoHelpers) {
  await h.page.locator('[data-testid="rising-column"][data-settled="true"]').first().waitFor({ timeout: 15_000 });
}

export const script: DemoScript = {
  title: 'Workshop Live Q&A: questions rise as the room votes',
  persona: 'demo-host',
  scenes: [
    {
      id: 'hook',
      say: [
        'This is Workshop Live Q&A, a question board for live training sessions, built as a Fabric App.',
        'Every question is a bubble in this column: the more votes it gets, the bigger it grows and the higher it rises.',
      ],
      async run(h) {
        await h.goto('/s/AGENTS', 'demo-host');
        await settled(h);
        await h.pause(2500);
        await h.spotlight(h.page.locator('[data-testid="bubble"][data-zone="dock"]'), 2500);
        await h.spotlight(h.page.locator('[data-testid="bubble"][data-zone="shelf"]').first(), 2000);
      },
    },
    {
      id: 'lenses',
      say: [
        'Lenses re-paint the same column: Newest floats the freshest questions up, and Answered swaps them in from the shelf.',
        'Pinned shows what the host docked at the top and what they parked for later.',
      ],
      async run(h) {
        await h.click(h.page.getByRole('radio', { name: /^Newest/ }));
        await settled(h);
        await h.pause(2200);
        await h.click(h.page.getByRole('radio', { name: /^Answered/ }));
        await settled(h);
        await h.pause(2200);
        await h.click(h.page.getByRole('radio', { name: /^Pinned/ }));
        await settled(h);
        await h.pause(1800);
        await h.click(h.page.getByRole('radio', { name: /^Top/ }));
        await settled(h);
      },
    },
    {
      id: 'today',
      say: ['The Today panel ranks what needs attention, and one click focuses the bubble behind it, with the host actions beside it.'],
      async run(h) {
        const today = h.page.getByRole('complementary', { name: 'Today' });
        await h.click(today.getByRole('button', { name: /finance team/ }));
        await settled(h);
        await h.spotlight(h.page.getByTestId('focus-card'), 3000);
        await h.page.keyboard.press('Escape');
      },
    },
    {
      id: 'view-as',
      say: ['The host can view the board as an attendee: hidden questions and anonymous names disappear, exactly as the room sees them.'],
      async run(h) {
        await h.click(h.page.getByRole('radio', { name: 'Attendee' }));
        await h.pause(1500);
        await h.click(h.page.getByRole('radio', { name: 'List' }));
        await h.scrollTo(h.page.getByTestId('list-row').filter({ hasText: 'SQL database directly' }));
        await h.spotlight(h.page.getByTestId('list-row').filter({ hasText: 'SQL database directly' }), 2500);
        await h.click(h.page.getByRole('radio', { name: 'Column' }));
        await h.click(h.page.getByRole('radio', { name: 'Host' }));
      },
    },
    {
      id: 'attendee',
      say: [
        'Attendees scan the QR code, or type the code, and land on the same column.',
        'Asking takes one box, and voting is a big button under the thumb; the bubble inflates as the vote lands.',
        'Each person can have five unanswered questions, and the limit is checked again just before saving.',
      ],
      async run(h) {
        await h.goto('/', 'demo-ana');
        await h.type(h.page.getByLabel('Session code'), 'AGENTS');
        await h.click(h.page.getByRole('button', { name: 'Join', exact: true }));
        await settled(h);
        await h.type(h.page.getByLabel('Your question'), 'How do you test an agent that calls a semantic model?');
        await h.click(h.page.getByRole('button', { name: 'Ask question' }));
        await h.pause(1200);
        await settled(h);
        const card = h.page.getByTestId('question-card').filter({ hasText: 'Where should human approval sit' });
        await h.scrollTo(card);
        await h.click(card.getByTestId('upvote-button'));
        await h.pause(1200);
        await h.spotlight(h.page.locator('[data-testid="bubble"][aria-label*="human approval"]'), 2000);
        await h.spotlight(h.page.getByTestId('open-count'), 1500);
      },
    },
    {
      id: 'host-deck',
      say: [
        'The host deck is a moderation queue built for the keyboard: J and K move, A marks answered, P pins.',
        'When someone else asks, a pill counts the new questions instead of reshuffling the queue while you read.',
        'Press the question mark for every shortcut.',
      ],
      async run(h) {
        await h.goto('/s/AGENTS/host', 'demo-host');
        await h.page.getByTestId('host-console').waitFor();
        await h.pause(800);
        await h.page.keyboard.press('j');
        await h.pause(600);
        await h.spotlight(h.page.getByTestId('spotlight'), 1500);
        await h.page.keyboard.press('a');
        await h.pause(1500);
        await anotherAttendeeAsks(h, 'Can an agent explain why it picked a tool?');
        const pill = h.page.getByTestId('new-questions-pill');
        await pill.waitFor({ timeout: 10_000 });
        await h.spotlight(pill, 1500);
        await h.click(pill);
        await h.pause(1000);
        await h.page.keyboard.press('Shift+?');
        await h.pause(2200);
        await h.page.keyboard.press('Escape');
      },
    },
    {
      id: 'big-screen',
      say: ['The big screen fills a projector with the top five in large type, the join code and a QR code, and re-orders as votes arrive.'],
      async run(h) {
        await h.goto('/s/AGENTS/screen', 'demo-host');
        await h.page.getByTestId('join-qr').waitFor();
        await h.pause(2500);
        await h.spotlight(h.page.getByTestId('screen-question').first(), 2500);
      },
    },
    {
      id: 'wrap-up',
      say: [
        'Closing the session opens the wrap-up: a snapshot of the column, then what was answered and what was not.',
        'It copies out as Markdown, with anonymous questions kept anonymous.',
      ],
      async run(h) {
        await h.goto('/s/AGENTS/host', 'demo-host');
        await h.click(h.page.getByRole('button', { name: 'Close session' }));
        await h.click(h.page.getByRole('dialog').getByRole('button', { name: 'Close session' }));
        await h.page.getByTestId('copy-markdown').waitFor();
        await h.pause(2000);
        await h.click(h.page.getByTestId('copy-markdown'));
        await h.scrollTo(h.page.getByTestId('wrapup-unanswered'));
        await h.pause(2000);
      },
    },
    {
      id: 'takeaway',
      say: ['Ask, vote, watch it rise: one small Fabric App keeps a workshop’s questions in one place.'],
      async run(h) {
        await h.goto('/s/LAKE25', 'demo-host');
        await settled(h);
        await h.pause(3000);
      },
    },
  ],
};
