/**
 * Session flows: create, find by code, join, load a board, close. All data access goes through DataStore, and every
 * permission and rule is checked here so it holds in demo mode and in Fabric alike.
 */
import { NotFoundError, PermissionError, RuleError, type CreateInput, type DataStore } from '@x10/shared/data';
import type { Person } from '@x10/shared/identity';

import type { QaSession, Question, Schema, Upvote } from '../model';
import {
  generateCode,
  isValidCode,
  normaliseCode,
  openCountFor,
  participantCount,
  scoreMap,
  trustedQuestions,
  validateSessionTitle,
  visibleQuestions,
  votedBy,
} from './rules';

type Store = DataStore<Schema>;

export async function findSessionByCode(store: Store, code: string): Promise<QaSession | null> {
  const c = normaliseCode(code);
  if (!isValidCode(c)) return null;
  const rows = await store.repo('QaSession').list({ where: { code: c }, limit: 2 });
  return rows[0] ?? null;
}

export type JoinResult =
  | { kind: 'invalid'; code: string }
  | { kind: 'unknown'; code: string }
  | { kind: 'closed'; code: string; session: QaSession }
  | { kind: 'open'; code: string; session: QaSession };

/** Resolve a typed or linked code. Unknown and closed codes come back as their own kinds for a friendly message. */
export async function resolveJoin(store: Store, input: string): Promise<JoinResult> {
  const code = normaliseCode(input);
  if (!isValidCode(code)) return { kind: 'invalid', code };
  const session = await findSessionByCode(store, code);
  if (!session) return { kind: 'unknown', code };
  return session.status === 'closed' ? { kind: 'closed', code, session } : { kind: 'open', code, session };
}

export interface NewSessionInput {
  title: string;
  allowAnonymous: boolean;
}

/** Hosts are admins (Person.isAdmin). The code is random and checked for uniqueness before insert. */
export async function createSession(
  store: Store,
  me: Person,
  isAdmin: boolean,
  input: NewSessionInput,
  now = new Date(),
  random: () => number = Math.random,
): Promise<QaSession> {
  if (!isAdmin) throw new PermissionError('Only hosts can create sessions. Ask an admin of this app to make you a host.');
  const msg = validateSessionTitle(input.title);
  if (msg) throw new RuleError(msg);
  let code = '';
  for (let attempt = 0; attempt < 12 && !code; attempt++) {
    const candidate = generateCode(random);
    if (!(await findSessionByCode(store, candidate))) code = candidate;
  }
  if (!code) throw new RuleError('Could not find a free join code. Please try again.');
  // closedAt is excluded from the create permission, so it is left out of the insert (it reads back as null).
  const row = {
    title: input.title.trim(),
    code,
    hostSub: me.sub,
    hostName: me.displayName,
    status: 'open',
    allowAnonymous: input.allowAnonymous,
    createdAt: now.toISOString(),
  } as const;
  return store.repo('QaSession').create(row as unknown as CreateInput<QaSession>);
}

export interface SessionSummary {
  session: QaSession;
  questions: number;
  open: number;
  answered: number;
}

/** Sessions hosted by me, newest first, with question counts (hidden ones excluded). */
export async function listMySessions(store: Store, me: Person): Promise<SessionSummary[]> {
  const [sessions, questions] = await Promise.all([
    store.repo('QaSession').list({ where: { hostSub: me.sub }, orderBy: { field: 'createdAt', dir: 'desc' } }),
    store.repo('Question').list({ where: { hostSub: me.sub } }),
  ]);
  return sessions.map((session) => {
    const mine = questions.filter((q) => q.sessionId === session.id && q.status !== 'hidden');
    return {
      session,
      questions: mine.length,
      open: mine.filter((q) => q.status === 'new' || q.status === 'parked').length,
      answered: mine.filter((q) => q.status === 'answered').length,
    };
  });
}

export async function closeSession(store: Store, me: Person, sessionId: string, now = new Date()): Promise<QaSession> {
  const session = await store.repo('QaSession').get(sessionId);
  if (!session) throw new NotFoundError('QaSession', sessionId);
  if (session.hostSub !== me.sub) throw new PermissionError('Only the host can close this session.');
  if (session.status === 'closed') return session;
  return store.repo('QaSession').update(sessionId, { status: 'closed', closedAt: now.toISOString() });
}

export interface Board {
  session: QaSession;
  isHost: boolean;
  /** Questions this viewer may see (attendees never get hidden ones). */
  questions: Question[];
  upvotes: Upvote[];
  scores: Map<string, number>;
  myVotes: Set<string>;
  /** My unanswered questions, re-counted from every row (the limit check). */
  myOpenCount: number;
  /** People who asked or voted, excluding the host. */
  participants: number;
}

/** Everything a live screen needs for one session, or null when the code is unknown. */
export async function loadBoard(store: Store, me: Pick<Person, 'sub'>, code: string): Promise<Board | null> {
  const session = await findSessionByCode(store, code);
  if (!session) return null;
  const [rows, upvotes] = await Promise.all([
    store.repo('Question').list({ where: { sessionId: session.id } }),
    store.repo('Upvote').list({ where: { sessionId: session.id } }),
  ]);
  // A row whose hostSub is not the session's host was not written by this app (forged through the API): the real host
  // could neither moderate nor delete it, so it never reaches any screen.
  const all = trustedQuestions(rows, session);
  const isHost = session.hostSub === me.sub;
  const questions = visibleQuestions(all, isHost);
  const ids = new Set(all.map((q) => q.id));
  // Votes on withdrawn (or untrusted) questions are left behind (only the voter may delete a vote); ignore them.
  const live = upvotes.filter((u) => ids.has(u.questionId));
  return {
    session,
    isHost,
    questions,
    upvotes: live,
    scores: scoreMap(live),
    myVotes: votedBy(live, me.sub),
    // Counted over every row, like the re-check in askQuestion.
    myOpenCount: openCountFor(rows, me.sub),
    participants: participantCount(all, live, session.hostSub),
  };
}
