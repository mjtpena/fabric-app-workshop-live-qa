import { describe, expect, it } from 'vitest';

import type { Question, QuestionStatus } from '../model';
import { arrange, columnOrder, radiusFor, type Lens } from './arrange';
import { hash01, layoutColumn, packRising, type Rect } from './pack';
import { isQuiet, makeBody, maxOffset, step, type Body } from './sim';
import { todayItems } from './today';

const NOW = new Date('2026-11-20T10:00:00Z');
const at = (minutesAgo: number) => new Date(NOW.getTime() - minutesAgo * 60000).toISOString();

function q(id: string, over: Partial<Question> = {}): Question {
  return {
    id,
    sessionId: 's1',
    text: `Question ${id}?`,
    authorSub: `a-${id}`,
    authorName: `Author ${id}`,
    isAnonymous: false,
    isPinned: false,
    status: 'new',
    hostSub: 'host',
    createdAt: at(40),
    answeredAt: null,
    ...over,
  };
}

/** A session of n questions with a spread of votes and statuses. */
function session(n: number) {
  const statuses: QuestionStatus[] = ['new', 'new', 'new', 'answered', 'parked', 'new', 'hidden'];
  const questions = Array.from({ length: n }, (_, i) =>
    q(`q${i}`, {
      status: statuses[i % statuses.length],
      isPinned: i === 2,
      createdAt: at(60 - i),
      answeredAt: statuses[i % statuses.length] === 'answered' ? at(20 - (i % 10)) : null,
    }),
  );
  const scores = new Map(questions.map((x, i) => [x.id, (i * 7) % 9]));
  return { questions, scores };
}

function overlaps(t: { x: number; y: number; r: number }[], tol = 0.5) {
  for (let i = 0; i < t.length; i++)
    for (let j = i + 1; j < t.length; j++) if (Math.hypot(t[i].x - t[j].x, t[i].y - t[j].y) < t[i].r + t[j].r - tol) return true;
  return false;
}

describe('arrange', () => {
  const { questions, scores } = session(14);

  it('docks pinned open questions, floats the rest by votes and shelves the answered ones (top lens)', () => {
    const b = arrange(questions, scores, 'top', NOW);
    expect(b.find((x) => x.id === 'q2')!.zone).toBe('dock');
    expect(b.filter((x) => x.zone === 'shelf').every((x) => x.q.status === 'answered')).toBe(true);
    expect(b.some((x) => x.q.status === 'hidden')).toBe(false);
    const main = b.filter((x) => x.zone === 'main').sort((a, c) => a.order - c.order);
    for (let i = 1; i < main.length; i++) expect(main[i].score).toBeLessThanOrEqual(main[i - 1].score);
    // Groups follow scores: equal scores share one.
    for (let i = 1; i < main.length; i++) expect(main[i].group >= main[i - 1].group).toBe(true);
  });

  it('swaps roles in the answered lens', () => {
    const b = arrange(questions, scores, 'answered', NOW);
    expect(b.filter((x) => x.zone === 'main').every((x) => x.q.status === 'answered')).toBe(true);
    expect(b.filter((x) => x.zone === 'shelf').every((x) => x.q.status !== 'answered')).toBe(true);
  });

  it('keeps the top-lens positions in the pinned lens and dims what is neither pinned nor parked', () => {
    const top = arrange(questions, scores, 'top', NOW);
    const pinned = arrange(questions, scores, 'pinned', NOW);
    expect(pinned.map((x) => [x.id, x.zone, x.order])).toEqual(top.map((x) => [x.id, x.zone, x.order]));
    expect(pinned.find((x) => x.id === 'q2')!.dim).toBe(false);
    expect(pinned.filter((x) => x.zone === 'main' && x.q.status === 'new').every((x) => x.dim)).toBe(true);
  });

  it('orders the newest lens by recency', () => {
    const b = columnOrder(arrange(questions, scores, 'newest', NOW)).filter((x) => x.zone === 'main');
    for (let i = 1; i < b.length; i++) expect(b[i].q.createdAt <= b[i - 1].q.createdAt).toBe(true);
  });

  it('grows the radius with votes, softly', () => {
    expect(radiusFor(4)).toBeGreaterThan(radiusFor(1));
    expect(radiusFor(16) / radiusFor(1)).toBeLessThan(3);
  });
});

describe('packing', () => {
  const rect: Rect = { left: 0, top: 0, right: 300, bottom: 700 };

  it('places circles without overlaps, inside the rect, never above a higher group', () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ id: `b${i}`, r: 14 + (i % 5) * 6, group: Math.floor(i / 2) }));
    const { placed, fits } = packRising(items, rect);
    expect(fits).toBe(true);
    expect(overlaps(placed)).toBe(false);
    for (const p of placed) {
      expect(p.x - p.r).toBeGreaterThanOrEqual(-0.01);
      expect(p.x + p.r).toBeLessThanOrEqual(300.01);
      expect(p.y - p.r).toBeGreaterThanOrEqual(-0.01);
    }
    for (let i = 0; i < placed.length; i++)
      for (let j = 0; j < placed.length; j++)
        if (items[i].group < items[j].group) expect(placed[j].y).toBeGreaterThanOrEqual(placed[i].y);
  });

  it('fits a 40-question session into a phone-sized column', () => {
    const { questions, scores } = session(40);
    for (const lens of ['top', 'newest', 'answered', 'pinned'] as Lens[]) {
      const bubbles = arrange(questions, scores, lens, NOW);
      const layout = layoutColumn(bubbles, { left: 0, top: 0, right: 360, bottom: 470 });
      const column = [...layout.targets.values()].filter((t) => t.zone !== 'shelf');
      expect(layout.targets.size).toBe(bubbles.length);
      expect(overlaps(column)).toBe(false);
      for (const t of column) expect(t.y + t.r).toBeLessThanOrEqual(layout.shelf.top + 0.5);
      const shelf = [...layout.targets.values()].filter((t) => t.zone === 'shelf');
      expect(overlaps(shelf)).toBe(false);
    }
  });

  it('is deterministic', () => {
    const { questions, scores } = session(14);
    const a = layoutColumn(arrange(questions, scores, 'top', NOW), rect);
    const b = layoutColumn(arrange(questions, scores, 'top', NOW), rect);
    expect([...a.targets.values()]).toEqual([...b.targets.values()]);
    expect(hash01('x')).toBe(hash01('x'));
  });
});

describe('simulation', () => {
  function settle(bodies: Body[], limit = 900) {
    let quiet = 0;
    for (let f = 0; f < limit; f++) {
      let speed = 0;
      for (let s = 0; s < 2; s++) speed = step(bodies, 1 / 120);
      quiet = isQuiet(speed, maxOffset(bodies)) ? quiet + 1 : 0;
      if (quiet >= 20) return f;
    }
    return -1;
  }

  it('brings 40 bubbles rising from the bottom to rest, smoothly and without NaN', () => {
    const { questions, scores } = session(40);
    const layout = layoutColumn(arrange(questions, scores, 'top', NOW), { left: 0, top: 0, right: 380, bottom: 620 });
    const bodies = [...layout.targets.values()].map((t, i) => makeBody(t, { x: t.x, y: 700 + i * 10, r: 2 }));
    const frames = settle(bodies);
    expect(frames).toBeGreaterThan(0);
    expect(frames).toBeLessThan(600); // under ten seconds at 60 fps
    for (const b of bodies) expect(Number.isFinite(b.x) && Number.isFinite(b.y)).toBe(true);
    expect(maxOffset(bodies)).toBeLessThan(1.5);
  });

  it('settles again after a re-order (votes push one bubble to the top)', () => {
    const { questions, scores } = session(20);
    const rect = { left: 0, top: 0, right: 320, bottom: 600 };
    const first = layoutColumn(arrange(questions, scores, 'top', NOW), rect);
    const bodies = [...first.targets.values()].map((t) => makeBody(t));
    const bumped = new Map(scores);
    bumped.set('q13', 30);
    const next = layoutColumn(arrange(questions, bumped, 'top', NOW), rect);
    for (const b of bodies) {
      const t = next.targets.get(b.id)!;
      Object.assign(b, { tx: t.x, ty: t.y, tr: t.r, zone: t.zone });
    }
    expect(settle(bodies)).toBeGreaterThan(0);
  });
});

describe('today', () => {
  const questions = [
    q('pinned', { isPinned: true, createdAt: at(40) }),
    q('popular', { createdAt: at(35) }),
    q('fresh', { createdAt: at(3), authorSub: 'me' }),
    q('done', { status: 'answered', answeredAt: at(2) }),
    q('hidden', { status: 'hidden' }),
  ];
  const scores = new Map([
    ['pinned', 2],
    ['popular', 5],
    ['fresh', 2],
  ]);
  const upvotes = [
    { questionId: 'fresh', createdAt: at(2) },
    { questionId: 'fresh', createdAt: at(1) },
    { questionId: 'popular', createdAt: at(30) },
  ];

  it('ranks the most wanted, the fastest rising and the newest, each with its lens', () => {
    const items = todayItems({ questions, upvotes, scores, now: NOW, sub: 'host', hostView: true });
    expect(items[0]).toMatchObject({ focusId: 'popular', lens: 'top', value: 5 });
    expect(items[1]).toMatchObject({ focusId: 'fresh', lens: 'top', value: '+2' });
    expect(items.some((i) => i.focusId === 'hidden')).toBe(false);
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(items.length).toBeLessThanOrEqual(5);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
  });

  it('shows an attendee where their own question stands', () => {
    const items = todayItems({ questions, upvotes, scores, now: NOW, sub: 'me', hostView: false });
    const mine = items.find((i) => i.id.startsWith('mine:'));
    expect(mine).toMatchObject({ focusId: 'fresh', value: '#3', unit: 'of 3' });
  });

  it('is empty for an empty session', () => {
    expect(todayItems({ questions: [], upvotes: [], scores: new Map(), now: NOW, sub: 'x', hostView: true })).toEqual([]);
  });
});
