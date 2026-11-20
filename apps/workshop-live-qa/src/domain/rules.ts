/**
 * Pure rules for Workshop Live Q&A: join codes, scoring, sorting, anonymity, moderation transitions,
 * the stable live list, the join link and the wrap-up Markdown. No store access here; everything is unit-tested.
 */
import { RuleError } from '@x10/shared/data';
import { checkText, plural } from '@x10/shared/lib';

import { rules } from '../config';
import { limits, type QaSession, type Question, type QuestionStatus, type Upvote } from '../model';

/* ------------------------------------------------------------------ codes */

/** Upper-case a typed code and drop spaces and dashes ("abc-123" → "ABC123"). */
export function normaliseCode(input: string | null | undefined): string {
  return (input ?? '').toUpperCase().replace(/[\s-]+/g, '');
}

export function isValidCode(code: string): boolean {
  return /^[A-Z0-9]{6}$/.test(code);
}

/** Inline message for the join box, or null when the code is well formed. */
export function validateCodeInput(input: string): string | null {
  const code = normaliseCode(input);
  if (!code) return 'Enter the 6-character code your host shared.';
  if (!isValidCode(code)) return 'Codes are 6 letters or digits, like ABC123.';
  return null;
}

/** A random join code from the unambiguous alphabet. `random` is injectable for tests. */
export function generateCode(random: () => number = Math.random): string {
  const a = rules.codeAlphabet;
  let out = '';
  for (let i = 0; i < rules.codeLength; i++) out += a[Math.floor(random() * a.length) % a.length];
  return out;
}

/** The `code` parameter of a query string ("?code=abc123&as=x" → "ABC123"), or null. */
export function codeFromQuery(query: string | null | undefined): string | null {
  if (!query) return null;
  const raw = new URLSearchParams(query.startsWith('?') ? query : `?${query}`).get('code');
  const code = normaliseCode(raw);
  return code ? code : null;
}

/**
 * The join link for a code: the app's own address (no query, no hash) plus the hash route.
 * `href` is usually `window.location.href`.
 */
export function joinLink(href: string, code: string): string {
  const u = new URL(href);
  return `${u.origin}${u.pathname}#/join?code=${encodeURIComponent(code)}`;
}

/* ------------------------------------------------------------------ validation */

export function validateSessionTitle(title: string): string | null {
  return checkText(title, { ...limits.sessionTitle, label: 'Title' });
}

export function validateQuestionText(text: string): string | null {
  return checkText(text, { ...limits.questionText, label: 'Your question' });
}

/* ------------------------------------------------------------------ scoring and sorting */

/** Unanswered means new or parked: these count towards the per-attendee limit and appear in the open list. */
export function isOpenStatus(status: QuestionStatus): boolean {
  return status === 'new' || status === 'parked';
}

/** Score per question: the number of distinct voters. Duplicate rows by one voter count once. */
export function scoreMap(upvotes: Pick<Upvote, 'questionId' | 'voterSub'>[]): Map<string, number> {
  const voters = new Map<string, Set<string>>();
  for (const u of upvotes) {
    const set = voters.get(u.questionId) ?? new Set<string>();
    set.add(u.voterSub);
    voters.set(u.questionId, set);
  }
  return new Map([...voters].map(([id, s]) => [id, s.size]));
}

/** Ids of the questions `sub` has upvoted. */
export function votedBy(upvotes: Pick<Upvote, 'questionId' | 'voterSub'>[], sub: string): Set<string> {
  return new Set(upvotes.filter((u) => u.voterSub === sub).map((u) => u.questionId));
}

/** Board order: pinned first, then score descending, then oldest first (id breaks exact ties). */
export function sortQuestions<Q extends Pick<Question, 'id' | 'isPinned' | 'createdAt'>>(
  questions: Q[],
  scores: Map<string, number>,
): Q[] {
  return [...questions].sort(
    (a, b) =>
      Number(b.isPinned) - Number(a.isPinned) ||
      (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id),
  );
}

export interface BoardSections<Q> {
  /** New and parked, in board order. */
  open: Q[];
  /** Answered, most recently answered first. */
  answered: Q[];
  /** Hidden; always empty for attendees. */
  hidden: Q[];
}

export function boardSections<Q extends Question>(questions: Q[], scores: Map<string, number>, isHost: boolean): BoardSections<Q> {
  const open = sortQuestions(questions.filter((q) => isOpenStatus(q.status)), scores);
  const answered = questions
    .filter((q) => q.status === 'answered')
    .sort((a, b) => (b.answeredAt ?? b.createdAt).localeCompare(a.answeredAt ?? a.createdAt));
  const hidden = isHost ? sortQuestions(questions.filter((q) => q.status === 'hidden'), scores) : [];
  return { open, answered, hidden };
}

/**
 * Questions this app could have written for a session: the app always copies the session's host onto the row, so a
 * row naming another host was forged through the API (the real host could not moderate or delete it). Drop it.
 */
export function trustedQuestions<Q extends Pick<Question, 'hostSub'>>(questions: Q[], session: { hostSub: string }): Q[] {
  return questions.filter((q) => q.hostSub === session.hostSub);
}

/** What a viewer may see: attendees never get hidden questions. */
export function visibleQuestions<Q extends Pick<Question, 'status'>>(questions: Q[], isHost: boolean): Q[] {
  return isHost ? questions : questions.filter((q) => q.status !== 'hidden');
}

/** The top N unanswered questions for the big screen. */
export function topForScreen<Q extends Question>(questions: Q[], scores: Map<string, number>, n: number = rules.bigScreenTop): Q[] {
  return boardSections(questions, scores, false).open.slice(0, n);
}

/** Open (new or parked) questions by one author. */
export function openCountFor(questions: Pick<Question, 'authorSub' | 'status'>[], authorSub: string): number {
  return questions.filter((q) => q.authorSub === authorSub && isOpenStatus(q.status)).length;
}

export function limitMessage(max: number = rules.maxOpenQuestionsPerAttendee): string {
  return `You already have ${max} unanswered questions in this session, which is the limit. Wait for one to be answered, or withdraw one, before asking again.`;
}

/** Refuse a new question when the author already has the maximum number open. */
export function assertCanAsk(openCount: number, max: number = rules.maxOpenQuestionsPerAttendee): void {
  if (openCount >= max) throw new RuleError(limitMessage(max));
}

/** People who asked or voted, excluding the host. */
export function participantCount(
  questions: Pick<Question, 'authorSub'>[],
  upvotes: Pick<Upvote, 'voterSub'>[],
  hostSub: string,
): number {
  const subs = new Set<string>([...questions.map((q) => q.authorSub), ...upvotes.map((u) => u.voterSub)]);
  subs.delete(hostSub);
  return subs.size;
}

/* ------------------------------------------------------------------ anonymity */

export interface ViewerRole {
  sub: string;
  isHost: boolean;
}

/**
 * The author line a viewer sees. Anonymous questions read "Anonymous" for everyone except the host, who sees the
 * real name. The author sees "Anonymous (you)" so they can recognise their own question.
 */
export function authorLabel(q: Pick<Question, 'authorName' | 'authorSub' | 'isAnonymous'>, viewer: ViewerRole): string {
  if (!q.isAnonymous) return q.authorName;
  if (viewer.isHost) return q.authorName;
  if (q.authorSub === viewer.sub) return 'Anonymous (you)';
  return 'Anonymous';
}

/* ------------------------------------------------------------------ moderation */

export type ModerationAction = 'answer' | 'park' | 'reopen' | 'hide' | 'unhide' | 'pin' | 'unpin';

export const ACTION_LABELS: Record<ModerationAction, string> = {
  answer: 'Mark answered',
  park: 'Park',
  reopen: 'Reopen',
  hide: 'Hide',
  unhide: 'Unhide',
  pin: 'Pin',
  unpin: 'Unpin',
};

/** The moderation actions that make sense for a question's current state, in button order. */
export function allowedActions(q: Pick<Question, 'status' | 'isPinned'>): ModerationAction[] {
  switch (q.status) {
    case 'new':
      return ['answer', q.isPinned ? 'unpin' : 'pin', 'park', 'hide'];
    case 'parked':
      return ['answer', q.isPinned ? 'unpin' : 'pin', 'reopen', 'hide'];
    case 'answered':
      return ['reopen', 'hide'];
    case 'hidden':
      return ['unhide'];
  }
}

/** The patch a moderation action applies. Throws RuleError when the action does not fit the current state. */
export function moderationPatch(
  q: Pick<Question, 'status' | 'isPinned'> & { answeredAt?: string | null },
  action: ModerationAction,
  now: Date,
): Partial<Pick<Question, 'status' | 'isPinned' | 'answeredAt'>> {
  if (!allowedActions(q).includes(action)) {
    throw new RuleError(`"${ACTION_LABELS[action]}" does not apply to a ${q.status} question. Refresh and try again.`);
  }
  switch (action) {
    case 'answer':
      return { status: 'answered', isPinned: false, answeredAt: now.toISOString() };
    case 'park':
      return { status: 'parked' };
    case 'reopen':
      return { status: 'new', answeredAt: null };
    case 'hide':
      return { status: 'hidden', isPinned: false };
    case 'unhide':
      // Hiding keeps answeredAt, so an answered question comes back answered. A parked one comes back as new
      // (there is no column remembering "parked"); the host can park it again.
      return q.answeredAt ? { status: 'answered' } : { status: 'new' };
    case 'pin':
      return { isPinned: true };
    case 'unpin':
      return { isPinned: false };
  }
}

/* ------------------------------------------------------------------ live list */

/**
 * Keep the list the reader is looking at stable while polling.
 * `shown` is the order on screen (null on first load); `sorted` is the fresh order.
 * Questions already on screen keep their positions (gone ones drop out); questions that are new to this list are
 * held back as `pending` until the reader asks for them (the "N new questions" pill).
 */
export function stabiliseOrder(shown: string[] | null, sorted: string[]): { order: string[]; pending: string[] } {
  if (!shown) return { order: [...sorted], pending: [] };
  const fresh = new Set(sorted);
  const seen = new Set(shown);
  return {
    order: shown.filter((id) => fresh.has(id)),
    pending: sorted.filter((id) => !seen.has(id)),
  };
}

export function newQuestionsLabel(n: number): string {
  return `${plural(n, 'new question')}`;
}

/* ------------------------------------------------------------------ wrap-up */

function oneLine(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * The wrap-up as Markdown. Anonymous questions always read "Anonymous" here (the export is meant to be shared with
 * attendees), hidden questions are left out.
 */
export function wrapUpMarkdown(session: QaSession, questions: Question[], scores: Map<string, number>): string {
  const { open, answered } = boardSections(questions, scores, false);
  const who = (q: Question) => (q.isAnonymous ? 'Anonymous' : q.authorName);
  const votes = (q: Question) => plural(scores.get(q.id) ?? 0, 'vote');
  const line = (q: Question, i: number) => `${i + 1}. ${oneLine(q.text)} — ${who(q)} · ${votes(q)}`;
  const day = (iso: string | null) => (iso ? iso.slice(0, 10) : '');
  const out = [
    `# ${oneLine(session.title)}: Q&A wrap-up`,
    '',
    `Code ${session.code} · Host ${session.hostName} · ${day(session.createdAt)}${session.closedAt ? ` · closed ${day(session.closedAt)}` : ''}`,
    `${plural(open.length + answered.length, 'question')}, ${answered.length} answered, ${open.length} not answered.`,
    '',
    `## Answered (${answered.length})`,
    '',
    ...(answered.length ? sortQuestions(answered, scores).map(line) : ['_None._']),
    '',
    `## Not answered (${open.length})`,
    '',
    ...(open.length ? open.map(line) : ['_None. Every question was answered._']),
    '',
  ];
  return out.join('\n');
}
