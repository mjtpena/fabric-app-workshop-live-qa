import type { CreateInput, DataStore } from '@x10/shared/data';
import { addMinutes } from '@x10/shared/lib';
import type { SeedContext } from '@x10/shared/runtime';

import type { QaSession, Question, QuestionStatus, Schema } from './model';

/** Join codes of the two seeded sessions (used by the e2e tests and the walkthrough). */
export const DEMO_CODES = { live: 'AGENTS', closed: 'LAKE25' } as const;

/** Fictional attendees who are not demo personas (a cohort of about a dozen people). */
const CROWD = [
  { sub: 'seed-attendee-1', name: 'Marta Kowalski' },
  { sub: 'seed-attendee-2', name: 'Omar Haddad' },
  { sub: 'seed-attendee-3', name: 'Lena Fischer' },
  { sub: 'seed-attendee-4', name: 'Tomas Ruiz' },
  { sub: 'seed-attendee-5', name: 'Grace Okafor' },
  { sub: 'seed-attendee-6', name: 'Hiro Tanaka' },
  { sub: 'seed-attendee-7', name: 'Nadia Petrova' },
];

interface SeedQuestion {
  /** A persona key or a crowd index 1..7. */
  by: 'ana' | 'ben' | 'chloe' | number;
  text: string;
  minutesAgo: number;
  votes: number;
  status?: QuestionStatus;
  anonymous?: boolean;
  pinned?: boolean;
  answeredMinutesAgo?: number;
}

/** "Designing AI Agents (demo)": 14 questions, 40 upvotes, every status, named and anonymous. */
export const LIVE_QUESTIONS: SeedQuestion[] = [
  { by: 'ben', text: 'How do you decide when a task needs an agent rather than a single prompt with a few tools?', minutesAgo: 40, votes: 6, pinned: true },
  { by: 'ana', text: 'What is a sensible way to evaluate an agent before it touches production data?', minutesAgo: 38, votes: 5 },
  { by: 1, text: 'Should each agent own its own memory store, or should a team of agents share one?', minutesAgo: 36, votes: 4 },
  { by: 2, text: 'What do you log so you can replay a bad agent run afterwards?', minutesAgo: 35, votes: 4, status: 'answered', answeredMinutesAgo: 22 },
  { by: 3, text: 'How do you stop an agent from looping on the same failing tool call?', minutesAgo: 34, votes: 3, anonymous: true, status: 'answered', answeredMinutesAgo: 16 },
  { by: 'chloe', text: 'Is it okay to let an agent write to a SQL database directly, or should every write go through an API?', minutesAgo: 33, votes: 5, anonymous: true },
  { by: 'ben', text: 'How small can the tool list get before the agent stops being useful?', minutesAgo: 30, votes: 2 },
  { by: 'ben', text: 'Can you share the slide with the planning-loop diagram after the session?', minutesAgo: 28, votes: 1, status: 'parked' },
  { by: 4, text: 'Where should human approval sit in a multi-step workflow?', minutesAgo: 25, votes: 3 },
  { by: 'ana', text: 'Do agents need different prompts for the planning step and the execution step?', minutesAgo: 24, votes: 2, status: 'answered', answeredMinutesAgo: 9 },
  { by: 5, text: 'What is the cheapest way to add guardrails without slowing every request down?', minutesAgo: 18, votes: 2 },
  { by: 'ben', text: 'How do you version agent prompts alongside the code that calls them?', minutesAgo: 12, votes: 1 },
  { by: 6, text: 'Off topic: is anyone selling a used standing desk?', minutesAgo: 10, votes: 0, status: 'hidden' },
  { by: 'chloe', text: 'Any tips for explaining agent running costs to a finance team?', minutesAgo: 5, votes: 2, anonymous: true },
];

/** "Lakehouse Modelling Basics (demo)": closed a week ago, a finished Q&A with one parked and one unanswered. */
export const CLOSED_QUESTIONS: SeedQuestion[] = [
  { by: 1, text: 'When should a table live in the lakehouse rather than the warehouse?', minutesAgo: 85, votes: 4, status: 'answered', answeredMinutesAgo: 70 },
  { by: 'ana', text: 'How do you handle slowly changing dimensions with Delta tables?', minutesAgo: 80, votes: 3, status: 'answered', answeredMinutesAgo: 60 },
  { by: 3, text: 'Is there a rule of thumb for partition sizes?', minutesAgo: 72, votes: 3, status: 'answered', answeredMinutesAgo: 50 },
  { by: 'ben', text: 'Can shortcuts replace copying data between workspaces?', minutesAgo: 66, votes: 2, status: 'answered', answeredMinutesAgo: 40 },
  { by: 5, text: 'How do you document column meanings so analysts actually read them?', minutesAgo: 55, votes: 1, status: 'answered', answeredMinutesAgo: 25 },
  { by: 'chloe', text: 'What is the best way to test a notebook before scheduling it?', minutesAgo: 45, votes: 2, status: 'parked' },
  { by: 7, text: 'Could we get the sample notebook used in the demo?', minutesAgo: 20, votes: 1 },
];

/** Fictional, generic seed data. Dates are computed from ctx.now. Runs once (runSeed checks a marker row). */
export async function seed(store: DataStore<Schema>, ctx: SeedContext): Promise<void> {
  const [host, ana, ben, chloe] = ctx.people;
  const named = { ana, ben, chloe };
  const who = (by: SeedQuestion['by']) =>
    typeof by === 'number' ? CROWD[by - 1] : { sub: named[by].sub, name: named[by].displayName };
  // Voters in a fixed rotation; the author never votes on their own question and the host never votes.
  const pool = [ana.sub, ben.sub, chloe.sub, ...CROWD.map((c) => c.sub)];

  async function addSession(
    s: Omit<QaSession, 'id' | 'hostSub' | 'hostName'>,
    questions: SeedQuestion[],
    at: (minutesAgo: number) => string,
  ) {
    const session = await store.repo('QaSession').create({ ...s, hostSub: host.sub, hostName: host.displayName });
    for (const [i, sq] of questions.entries()) {
      const author = who(sq.by);
      const row: CreateInput<Question> = {
        sessionId: session.id,
        text: sq.text,
        authorSub: author.sub,
        authorName: author.name,
        isAnonymous: sq.anonymous ?? false,
        isPinned: sq.pinned ?? false,
        status: sq.status ?? 'new',
        hostSub: host.sub,
        createdAt: at(sq.minutesAgo),
        answeredAt: sq.answeredMinutesAgo !== undefined ? at(sq.answeredMinutesAgo) : null,
      };
      const q = await store.repo('Question').create(row);
      const offset = i % pool.length;
      const voters = [...pool.slice(offset), ...pool.slice(0, offset)].filter((v) => v !== author.sub);
      for (let k = 0; k < sq.votes; k++) {
        await store.repo('Upvote').create({
          questionId: q.id,
          sessionId: session.id,
          voterSub: voters[k],
          createdAt: at(Math.max(1, sq.minutesAgo - (k + 1))),
        });
      }
    }
  }

  await addSession(
    {
      title: 'Designing AI Agents (demo)',
      code: DEMO_CODES.live,
      status: 'open',
      allowAnonymous: true,
      createdAt: addMinutes(ctx.now, -45),
      closedAt: null,
    },
    LIVE_QUESTIONS,
    (m) => addMinutes(ctx.now, -m),
  );

  // The closed session ran for 95 minutes a week ago; its "minutes ago" count back from when it closed.
  const closedStart = addMinutes(ctx.now, -7 * 24 * 60);
  const closedEnd = addMinutes(closedStart, 95);
  await addSession(
    {
      title: 'Lakehouse Modelling Basics (demo)',
      code: DEMO_CODES.closed,
      status: 'closed',
      allowAnonymous: false,
      createdAt: closedStart,
      closedAt: closedEnd,
    },
    CLOSED_QUESTIONS,
    (m) => addMinutes(closedEnd, -m),
  );
}
