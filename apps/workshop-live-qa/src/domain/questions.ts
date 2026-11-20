/**
 * Question and upvote flows: ask, withdraw, toggle an upvote, moderate, edit. Every rule is re-checked here against
 * fresh rows just before the write, so a stale screen can never break a rule.
 */
import { NotFoundError, PermissionError, RuleError, type CreateInput, type DataStore } from '@x10/shared/data';
import type { Person } from '@x10/shared/identity';

import type { QaSession, Question, Schema, Upvote } from '../model';
import { assertCanAsk, moderationPatch, openCountFor, validateQuestionText, type ModerationAction } from './rules';

type Store = DataStore<Schema>;
type Me = Pick<Person, 'sub' | 'displayName'>;

async function sessionOf(store: Store, sessionId: string): Promise<QaSession> {
  const s = await store.repo('QaSession').get(sessionId);
  if (!s) throw new NotFoundError('QaSession', sessionId);
  return s;
}

function assertOpen(session: QaSession) {
  if (session.status !== 'open') throw new RuleError('This session is closed, so it is read-only now.');
}

async function questionOrGone(store: Store, questionId: string): Promise<Question> {
  const q = await store.repo('Question').get(questionId);
  if (!q) throw new RuleError('That question is no longer there. It may have been withdrawn.');
  return q;
}

export interface AskInput {
  text: string;
  anonymous: boolean;
}

/**
 * Post a question. Re-checks the session state, anonymity and the per-attendee limit by query just before insert.
 */
export async function askQuestion(store: Store, me: Me, sessionId: string, input: AskInput, now = new Date()): Promise<Question> {
  const msg = validateQuestionText(input.text);
  if (msg) throw new RuleError(msg);
  const session = await sessionOf(store, sessionId);
  assertOpen(session);
  if (session.hostSub === me.sub) {
    throw new RuleError('You are the host of this session. Attendees ask here; you moderate from the host console.');
  }
  if (input.anonymous && !session.allowAnonymous) {
    throw new RuleError('This session does not allow anonymous questions. Untick "Ask anonymously" to post with your name.');
  }
  const mine = await store.repo('Question').list({ where: { sessionId, authorSub: me.sub } });
  assertCanAsk(openCountFor(mine, me.sub));
  // answeredAt is excluded from the create permission, so it is left out of the insert (it reads back as null).
  const row = {
    sessionId,
    text: input.text.trim(),
    authorSub: me.sub,
    authorName: me.displayName,
    isAnonymous: input.anonymous,
    isPinned: false,
    status: 'new',
    hostSub: session.hostSub,
    createdAt: now.toISOString(),
  } as const;
  return store.repo('Question').create(row as unknown as CreateInput<Question>);
}

/** Authors may withdraw their own unanswered question while the session is open (attendees edit by re-asking). */
export async function withdrawQuestion(store: Store, me: Me, questionId: string): Promise<Question> {
  const q = await questionOrGone(store, questionId);
  if (q.authorSub !== me.sub) throw new PermissionError('You can only withdraw your own questions.');
  if (q.status === 'answered') throw new RuleError('Answered questions stay on the record.');
  assertOpen(await sessionOf(store, q.sessionId));
  // Remove my own vote too (other people's votes are theirs to remove; the board ignores votes on missing questions).
  const myVotes = await store.repo('Upvote').list({ where: { questionId, voterSub: me.sub } });
  for (const v of myVotes) await store.repo('Upvote').remove(v.id);
  await store.repo('Question').remove(questionId);
  return q;
}

/**
 * Toggle my upvote. Returns true when the question is now upvoted by me.
 * Refuses when the host has hidden or answered the question meanwhile, on my own question, and for the host.
 */
export async function toggleUpvote(store: Store, me: Me, questionId: string, now = new Date()): Promise<boolean> {
  const q = await questionOrGone(store, questionId);
  if (q.status === 'hidden') throw new RuleError('The host has hidden this question, so it no longer takes votes.');
  if (q.status === 'answered') throw new RuleError('This question has just been answered, so voting on it is closed.');
  if (q.authorSub === me.sub) throw new RuleError('You cannot upvote your own question.');
  if (q.hostSub === me.sub) throw new RuleError('Hosts do not vote in their own session.');
  assertOpen(await sessionOf(store, q.sessionId));
  const votes = store.repo('Upvote');
  const existing = await votes.list({ where: { questionId, voterSub: me.sub } });
  if (existing.length) {
    // Remove every one of my rows, so an accidental duplicate never lingers.
    for (const v of existing) await votes.remove(v.id);
    return false;
  }
  const row: CreateInput<Upvote> = { questionId, sessionId: q.sessionId, voterSub: me.sub, createdAt: now.toISOString() };
  await votes.create(row);
  return true;
}

async function asHost(store: Store, me: Me, questionId: string): Promise<Question> {
  const q = await questionOrGone(store, questionId);
  const session = await sessionOf(store, q.sessionId);
  if (session.hostSub !== me.sub) throw new PermissionError('Only the host can moderate questions in this session.');
  assertOpen(session);
  return q;
}

export async function moderateQuestion(
  store: Store,
  me: Me,
  questionId: string,
  action: ModerationAction,
  now = new Date(),
): Promise<Question> {
  const q = await asHost(store, me, questionId);
  return store.repo('Question').update(questionId, moderationPatch(q, action, now));
}

/** The host may reword a question (typos, merging duplicates). */
export async function editQuestionText(store: Store, me: Me, questionId: string, text: string): Promise<Question> {
  const msg = validateQuestionText(text);
  if (msg) throw new RuleError(msg);
  await asHost(store, me, questionId);
  return store.repo('Question').update(questionId, { text: text.trim() });
}
