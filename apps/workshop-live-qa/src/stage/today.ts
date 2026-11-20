/**
 * The Today panel for a live session: the three to five questions that need attention now, ranked. Each one names
 * the lens it belongs to and the bubble it focuses. Pure, so it is unit-tested.
 */
import { truncate } from '@x10/shared/lib';

import { isOpenStatus, sortQuestions } from '../domain/rules';
import type { Question, Upvote } from '../model';
import type { Lens } from './arrange';

export type TodayTone = 'brand' | 'info' | 'warn' | 'ok' | 'neutral' | 'bad';

export interface TodayDef {
  /** Unique per item (an item kind plus the question id). */
  id: string;
  /** The bubble this item focuses. */
  focusId: string;
  lens: Lens;
  title: string;
  severity: TodayTone;
  value: string | number;
  unit: string;
}

export interface TodayInput {
  questions: Question[];
  upvotes: Pick<Upvote, 'questionId' | 'createdAt'>[];
  scores: Map<string, number>;
  now: Date;
  /** The viewer's sub (for "your question"). */
  sub: string;
  /** Host view: adds "waiting longest"; attendee view adds "your question". */
  hostView: boolean;
  /** Window for "rising fastest", in minutes. */
  risingMinutes?: number;
}

const short = (q: Question) => truncate(q.text.replace(/\s+/g, ' ').trim(), 64);
const minutesAgo = (iso: string, now: Date) => Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));

export function todayItems(input: TodayInput): TodayDef[] {
  const { questions, upvotes, scores, now, sub, hostView, risingMinutes = 10 } = input;
  const open = sortQuestions(
    questions.filter((q) => isOpenStatus(q.status)),
    scores,
  );
  const answered = questions
    .filter((q) => q.status === 'answered')
    .sort((a, b) => (b.answeredAt ?? '').localeCompare(a.answeredAt ?? ''));
  const items: TodayDef[] = [];
  const score = (q: Question) => scores.get(q.id) ?? 0;

  // 1. The most wanted open question (by votes, ignoring pins).
  const top = [...open].sort((a, b) => score(b) - score(a) || a.createdAt.localeCompare(b.createdAt))[0];
  if (top) {
    items.push({ id: `top:${top.id}`, focusId: top.id, lens: 'top', title: short(top), severity: 'brand', value: score(top), unit: score(top) === 1 ? 'vote' : 'votes' });
  }

  // 2. Rising fastest: most votes in the last few minutes.
  const since = now.getTime() - risingMinutes * 60000;
  const recent = new Map<string, number>();
  for (const u of upvotes) if (new Date(u.createdAt).getTime() >= since) recent.set(u.questionId, (recent.get(u.questionId) ?? 0) + 1);
  const rising = open
    .filter((q) => (recent.get(q.id) ?? 0) > 0)
    .sort((a, b) => (recent.get(b.id) ?? 0) - (recent.get(a.id) ?? 0) || b.createdAt.localeCompare(a.createdAt))[0];
  if (rising && rising.id !== top?.id) {
    items.push({
      id: `rising:${rising.id}`,
      focusId: rising.id,
      lens: 'top',
      title: short(rising),
      severity: 'info',
      value: `+${recent.get(rising.id)}`,
      unit: `in ${risingMinutes} min`,
    });
  }

  if (hostView) {
    // 3. Waiting longest: the oldest unpinned new question that people want (2+ votes).
    const waiting = open
      .filter((q) => q.status === 'new' && !q.isPinned && score(q) >= 2 && q.id !== top?.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    if (waiting) {
      items.push({ id: `waiting:${waiting.id}`, focusId: waiting.id, lens: 'newest', title: short(waiting), severity: 'warn', value: minutesAgo(waiting.createdAt, now), unit: 'min waiting' });
    }
  } else {
    // 3. Your own best-placed open question.
    const mine = open.find((q) => q.authorSub === sub);
    if (mine) {
      items.push({ id: `mine:${mine.id}`, focusId: mine.id, lens: 'top', title: short(mine), severity: 'brand', value: `#${open.indexOf(mine) + 1}`, unit: `of ${open.length}` });
    }
  }

  // 4. The newest question.
  const newest = [...open].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (newest && !items.some((i) => i.focusId === newest.id)) {
    items.push({ id: `newest:${newest.id}`, focusId: newest.id, lens: 'newest', title: short(newest), severity: 'neutral', value: minutesAgo(newest.createdAt, now), unit: 'min ago' });
  }

  // 5. Pinned by the host, else the latest answer.
  const pinned = open.filter((q) => q.isPinned);
  if (pinned.length && !items.some((i) => i.focusId === pinned[0].id)) {
    items.push({ id: `pinned:${pinned[0].id}`, focusId: pinned[0].id, lens: 'pinned', title: short(pinned[0]), severity: 'neutral', value: pinned.length, unit: 'pinned' });
  } else if (answered[0]) {
    items.push({ id: `answered:${answered[0].id}`, focusId: answered[0].id, lens: 'answered', title: short(answered[0]), severity: 'ok', value: answered.length, unit: 'answered' });
  }

  return items.slice(0, 5);
}
