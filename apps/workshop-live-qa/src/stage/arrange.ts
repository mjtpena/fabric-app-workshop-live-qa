/**
 * The rising-questions metaphor as pure data: which zone each question sits in (the pinned dock at the top, the main
 * column, the answered shelf at the bottom), in what order, at what size and in what colour for each lens.
 * No React and no DOM here; the column component and the big screen both draw from this.
 */
import { isOpenStatus, sortQuestions } from '../domain/rules';
import type { Question } from '../model';

export const LENSES = ['top', 'newest', 'answered', 'pinned'] as const;
export type Lens = (typeof LENSES)[number];

export type Zone = 'dock' | 'main' | 'shelf';

export interface Bubble {
  id: string;
  q: Question;
  score: number;
  zone: Zone;
  /** Position in the lens order within its zone (0 = highest). */
  order: number;
  /**
   * Packing group: a bubble is never drawn above a bubble of a lower group. Equal groups (equal scores) may sit side
   * by side.
   */
  group: number;
  /** Rank among open questions in board order (1-based), or null for answered and hidden ones. */
  rank: number | null;
  /** Base radius before the column scales everything to fit. */
  r: number;
  fill: string;
  /** Text colour that reads on `fill`. */
  ink: string;
  dim: boolean;
  dashed: boolean;
}

/** Bubble radius from votes: a soft square-root so 20 votes is not ten times the size of 2. */
export function radiusFor(votes: number): number {
  return 20 + 12 * Math.sqrt(Math.max(0, votes));
}

/** Shelf marbles are small and all the same size. */
export const MARBLE_R = 8;

const A = (n: number) => `var(--accent-${n})`;

/** Fill and ink for the Top lens: deeper violet for more votes. */
export function voteTone(votes: number, max: number): { fill: string; ink: string } {
  const t = max <= 0 ? 0 : votes / max;
  if (votes === 0) return { fill: A(5), ink: A(12) };
  if (t < 0.34) return { fill: A(7), ink: A(12) };
  if (t < 0.67) return { fill: A(9), ink: 'var(--accent-contrast)' };
  return { fill: A(10), ink: 'var(--accent-contrast)' };
}

/** Fill and ink for the Newest lens: fresh questions are bright blue, older ones fade to grey. */
export function ageTone(minutes: number): { fill: string; ink: string } {
  if (minutes <= 10) return { fill: 'var(--blue-9)', ink: 'var(--blue-contrast)' };
  if (minutes <= 20) return { fill: 'var(--blue-7)', ink: 'var(--blue-12)' };
  if (minutes <= 35) return { fill: 'var(--blue-5)', ink: 'var(--blue-12)' };
  return { fill: 'var(--gray-5)', ink: 'var(--gray-12)' };
}

/** Fill and ink for answered questions: the most recent answers are the greenest. */
export function answeredTone(minutesSinceAnswer: number): { fill: string; ink: string } {
  if (minutesSinceAnswer <= 10) return { fill: 'var(--green-9)', ink: 'var(--green-contrast)' };
  if (minutesSinceAnswer <= 30) return { fill: 'var(--green-7)', ink: 'var(--green-12)' };
  return { fill: 'var(--green-5)', ink: 'var(--green-12)' };
}

const PARKED = { fill: 'var(--gray-6)', ink: 'var(--gray-12)' };
const MARBLE_ANSWERED = { fill: 'var(--green-8)', ink: 'var(--green-12)' };
const MARBLE_OPEN = { fill: 'var(--accent-7)', ink: 'var(--accent-12)' };

function minutesSince(iso: string | null, now: Date): number {
  if (!iso) return Infinity;
  return Math.max(0, (now.getTime() - new Date(iso).getTime()) / 60000);
}

/**
 * Arrange the questions a viewer can see for one lens. Hidden questions never enter the column (the host sees them
 * in the list and in the host deck).
 *
 * - top: pinned open questions dock at the top; the rest rise by votes; answered ones rest on the shelf.
 * - pinned: the same positions as top (so nothing moves), pinned and parked are lit and the rest dim.
 * - newest: no dock; open questions rise by recency; answered on the shelf.
 * - answered: the roles swap: answered questions fill the column by answer time, open ones wait on the shelf.
 */
export function arrange(questions: Question[], scores: Map<string, number>, lens: Lens, now: Date = new Date()): Bubble[] {
  const score = (q: Question) => scores.get(q.id) ?? 0;
  const visible = questions.filter((q) => q.status !== 'hidden');
  const open = sortQuestions(
    visible.filter((q) => isOpenStatus(q.status)),
    scores,
  );
  const answered = visible
    .filter((q) => q.status === 'answered')
    .sort((a, b) => (b.answeredAt ?? b.createdAt).localeCompare(a.answeredAt ?? a.createdAt) || a.id.localeCompare(b.id));
  const rankOf = new Map(open.map((q, i) => [q.id, i + 1]));
  const max = Math.max(1, ...visible.map(score));
  const out: Bubble[] = [];
  const push = (q: Question, zone: Zone, order: number, group: number, tone: { fill: string; ink: string }, extra?: Partial<Bubble>) =>
    out.push({
      id: q.id,
      q,
      score: score(q),
      zone,
      order,
      group,
      rank: rankOf.get(q.id) ?? null,
      r: zone === 'shelf' ? MARBLE_R : radiusFor(score(q)),
      fill: tone.fill,
      ink: tone.ink,
      dim: false,
      dashed: q.status === 'parked',
      ...extra,
    });

  if (lens === 'top' || lens === 'pinned') {
    const docked = open.filter((q) => q.isPinned);
    const rising = open.filter((q) => !q.isPinned);
    const toneFor = (q: Question) => {
      if (lens === 'pinned') {
        if (q.isPinned) return { fill: A(10), ink: 'var(--accent-contrast)' };
        if (q.status === 'parked') return { fill: 'var(--amber-7)', ink: 'var(--amber-12)' };
        return { fill: 'var(--gray-5)', ink: 'var(--gray-11)' };
      }
      return q.status === 'parked' ? PARKED : voteTone(score(q), max);
    };
    const dimFor = (q: Question) => lens === 'pinned' && !q.isPinned && q.status !== 'parked';
    docked.forEach((q, i) => push(q, 'dock', i, 0, toneFor(q), { dim: dimFor(q) }));
    // Equal scores share a group so they can sit side by side; a lower score never floats above a higher one.
    rising.forEach((q, i) => push(q, 'main', i, 1000 - score(q), toneFor(q), { dim: dimFor(q) }));
    answered.forEach((q, i) => push(q, 'shelf', i, 0, MARBLE_ANSWERED, { dim: lens === 'pinned' }));
    return out;
  }

  if (lens === 'newest') {
    const byNew = [...open].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
    byNew.forEach((q, i) => push(q, 'main', i, i, q.status === 'parked' ? PARKED : ageTone(minutesSince(q.createdAt, now))));
    answered.forEach((q, i) => push(q, 'shelf', i, 0, MARBLE_ANSWERED));
    return out;
  }

  // answered
  answered.forEach((q, i) => push(q, 'main', i, i, answeredTone(minutesSince(q.answeredAt, now)), { dashed: false }));
  open.forEach((q, i) => push(q, 'shelf', i, 0, MARBLE_OPEN));
  return out;
}

/** Lens order of the bubbles in the column (dock first, then main), for keyboard stepping and callouts. */
export function columnOrder(bubbles: Bubble[]): Bubble[] {
  const zoneRank: Record<Zone, number> = { dock: 0, main: 1, shelf: 2 };
  return [...bubbles].sort((a, b) => zoneRank[a.zone] - zoneRank[b.zone] || a.order - b.order);
}
