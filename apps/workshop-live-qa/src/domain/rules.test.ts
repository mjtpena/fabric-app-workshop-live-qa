import QRCode from 'qrcode';

import type { QaSession, Question } from '../model';
import {
  allowedActions,
  assertCanAsk,
  authorLabel,
  boardSections,
  codeFromQuery,
  generateCode,
  isValidCode,
  joinLink,
  limitMessage,
  moderationPatch,
  newQuestionsLabel,
  normaliseCode,
  openCountFor,
  participantCount,
  scoreMap,
  sortQuestions,
  stabiliseOrder,
  topForScreen,
  trustedQuestions,
  validateCodeInput,
  validateQuestionText,
  validateSessionTitle,
  visibleQuestions,
  votedBy,
  wrapUpMarkdown,
} from './rules';

const NOW = new Date('2026-11-20T09:00:00.000Z');

function q(id: string, over: Partial<Question> = {}): Question {
  return {
    id,
    sessionId: 's1',
    text: `Question ${id}`,
    authorSub: 'a',
    authorName: 'Ana',
    isAnonymous: false,
    isPinned: false,
    status: 'new',
    hostSub: 'host',
    createdAt: '2026-11-20T08:00:00.000Z',
    answeredAt: null,
    ...over,
  };
}

const vote = (questionId: string, voterSub: string) => ({ questionId, voterSub });

describe('join codes', () => {
  it('normalises typed codes', () => {
    expect(normaliseCode(' abc-123 ')).toBe('ABC123');
    expect(normaliseCode(null)).toBe('');
  });

  it('validates the format with friendly messages', () => {
    expect(isValidCode('ABC123')).toBe(true);
    expect(isValidCode('ABC12')).toBe(false);
    expect(isValidCode('ABC12!')).toBe(false);
    expect(validateCodeInput('')).toMatch(/Enter the 6-character code/);
    expect(validateCodeInput('abc')).toMatch(/6 letters or digits/);
    expect(validateCodeInput('abc 123')).toBeNull();
  });

  it('generates 6-character codes from the unambiguous alphabet', () => {
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 50; i++) {
      const c = generateCode(rand);
      expect(isValidCode(c)).toBe(true);
      expect(c).not.toMatch(/[01IO]/);
    }
    expect(generateCode(() => 0)).toBe('AAAAAA');
    expect(generateCode(() => 0.9999999)).toBe('999999');
  });

  it('reads ?code= from a query string', () => {
    expect(codeFromQuery('?code=abc123')).toBe('ABC123');
    expect(codeFromQuery('as=demo-ana&code=xyz789')).toBe('XYZ789');
    expect(codeFromQuery('?as=demo-ana')).toBeNull();
    expect(codeFromQuery('')).toBeNull();
  });

  it('builds the join link from the current address, dropping query and hash', () => {
    expect(joinLink('https://app.example.com/qa/index.html?as=x#/s/ABC123/screen', 'ABC123')).toBe(
      'https://app.example.com/qa/index.html#/join?code=ABC123',
    );
    expect(joinLink('http://localhost:5206/#/', 'AGENTS')).toBe('http://localhost:5206/#/join?code=AGENTS');
  });

  it('the join link round-trips through a QR code', () => {
    const link = joinLink('https://app.example.com/#/s/AGENTS/screen', 'AGENTS');
    const qr = QRCode.create(link, { errorCorrectionLevel: 'M' });
    const encoded = qr.segments.map((s) => (s as unknown as { data: Uint8Array | string }).data);
    const text = encoded.map((d) => (typeof d === 'string' ? d : new TextDecoder().decode(d))).join('');
    expect(text).toBe(link);
    expect(qr.modules.size).toBeGreaterThan(20);
  });
});

describe('validation', () => {
  it('uses the entity limits', () => {
    expect(validateSessionTitle('ab')).toMatch(/at least 3/);
    expect(validateSessionTitle('x'.repeat(101))).toMatch(/100 characters or fewer/);
    expect(validateSessionTitle('Weekly data clinic')).toBeNull();
    expect(validateQuestionText('  ')).toMatch(/required/);
    expect(validateQuestionText('Hi')).toMatch(/at least 3/);
    expect(validateQuestionText('x'.repeat(281))).toMatch(/280 characters or fewer/);
    expect(validateQuestionText('x'.repeat(280))).toBeNull();
  });
});

describe('scoring and sorting', () => {
  it('counts distinct voters per question (duplicates and simultaneous votes)', () => {
    const scores = scoreMap([vote('q1', 'a'), vote('q1', 'b'), vote('q1', 'a'), vote('q2', 'c')]);
    expect(scores.get('q1')).toBe(2);
    expect(scores.get('q2')).toBe(1);
    expect(scores.get('q3')).toBeUndefined();
    expect([...votedBy([vote('q1', 'a'), vote('q2', 'b')], 'a')]).toEqual(['q1']);
  });

  it('sorts pinned first, then score descending, then oldest first', () => {
    const list = [
      q('old-low', { createdAt: '2026-11-20T08:00:00Z' }),
      q('new-high', { createdAt: '2026-11-20T08:30:00Z' }),
      q('pinned', { isPinned: true, createdAt: '2026-11-20T08:45:00Z' }),
      q('old-high', { createdAt: '2026-11-20T08:10:00Z' }),
    ];
    const scores = new Map([
      ['new-high', 3],
      ['old-high', 3],
      ['old-low', 1],
    ]);
    expect(sortQuestions(list, scores).map((x) => x.id)).toEqual(['pinned', 'old-high', 'new-high', 'old-low']);
  });

  it('splits open, answered and hidden; attendees never see hidden', () => {
    const list = [
      q('n'),
      q('p', { status: 'parked' }),
      q('a1', { status: 'answered', answeredAt: '2026-11-20T08:10:00Z' }),
      q('a2', { status: 'answered', answeredAt: '2026-11-20T08:20:00Z' }),
      q('h', { status: 'hidden' }),
    ];
    const host = boardSections(list, new Map(), true);
    expect(host.open.map((x) => x.id)).toEqual(['n', 'p']);
    expect(host.answered.map((x) => x.id)).toEqual(['a2', 'a1']);
    expect(host.hidden.map((x) => x.id)).toEqual(['h']);
    expect(boardSections(list, new Map(), false).hidden).toEqual([]);
    expect(visibleQuestions(list, false).map((x) => x.id)).not.toContain('h');
    expect(visibleQuestions(list, true)).toHaveLength(5);
  });

  it('picks the top unanswered questions for the big screen', () => {
    const list = Array.from({ length: 8 }, (_, i) => q(`q${i}`, { createdAt: `2026-11-20T08:0${i}:00Z` }));
    list.push(q('ans', { status: 'answered' }), q('hid', { status: 'hidden' }));
    const scores = new Map([
      ['q7', 9],
      ['ans', 20],
      ['hid', 20],
    ]);
    const top = topForScreen(list, scores, 5);
    expect(top.map((x) => x.id)).toEqual(['q7', 'q0', 'q1', 'q2', 'q3']);
  });

  it('drops questions whose hostSub is not the session host (forged through the API)', () => {
    const list = [q('ok'), q('forged', { hostSub: 'x' })];
    expect(trustedQuestions(list, { hostSub: 'host' }).map((x) => x.id)).toEqual(['ok']);
  });

  it('counts participants who asked or voted, without the host', () => {
    expect(participantCount([{ authorSub: 'a' }, { authorSub: 'b' }], [{ voterSub: 'b' }, { voterSub: 'c' }, { voterSub: 'host' }], 'host')).toBe(3);
  });
});

describe('question limit', () => {
  it('counts only new and parked questions by that author', () => {
    const list = [
      q('1'),
      q('2', { status: 'parked' }),
      q('3', { status: 'answered' }),
      q('4', { status: 'hidden' }),
      q('5', { authorSub: 'other' }),
    ];
    expect(openCountFor(list, 'a')).toBe(2);
  });

  it('accepts the fifth and refuses the sixth', () => {
    expect(() => assertCanAsk(4)).not.toThrow();
    expect(() => assertCanAsk(5)).toThrow(limitMessage(5));
    expect(limitMessage(5)).toMatch(/5 unanswered questions/);
  });
});

describe('anonymity', () => {
  const anon = { authorName: 'Chloe Nguyen', authorSub: 'chloe', isAnonymous: true };
  it('shows Anonymous to attendees, the real name to the host, and "you" to the author', () => {
    expect(authorLabel(anon, { sub: 'ana', isHost: false })).toBe('Anonymous');
    expect(authorLabel(anon, { sub: 'host', isHost: true })).toBe('Chloe Nguyen');
    expect(authorLabel(anon, { sub: 'chloe', isHost: false })).toBe('Anonymous (you)');
    expect(authorLabel({ ...anon, isAnonymous: false }, { sub: 'ana', isHost: false })).toBe('Chloe Nguyen');
  });
});

describe('moderation transitions', () => {
  it('lists the actions per state', () => {
    expect(allowedActions({ status: 'new', isPinned: false })).toEqual(['answer', 'pin', 'park', 'hide']);
    expect(allowedActions({ status: 'new', isPinned: true })).toEqual(['answer', 'unpin', 'park', 'hide']);
    expect(allowedActions({ status: 'parked', isPinned: false })).toEqual(['answer', 'pin', 'reopen', 'hide']);
    expect(allowedActions({ status: 'answered', isPinned: false })).toEqual(['reopen', 'hide']);
    expect(allowedActions({ status: 'hidden', isPinned: false })).toEqual(['unhide']);
  });

  it('answering stamps the time and unpins', () => {
    expect(moderationPatch({ status: 'new', isPinned: true }, 'answer', NOW)).toEqual({
      status: 'answered',
      isPinned: false,
      answeredAt: NOW.toISOString(),
    });
  });

  it('reopen and unhide go back to new; hide unpins', () => {
    expect(moderationPatch({ status: 'answered', isPinned: false }, 'reopen', NOW)).toEqual({ status: 'new', answeredAt: null });
    expect(moderationPatch({ status: 'hidden', isPinned: false }, 'unhide', NOW)).toEqual({ status: 'new' });
    expect(moderationPatch({ status: 'hidden', isPinned: false, answeredAt: null }, 'unhide', NOW)).toEqual({ status: 'new' });
    expect(moderationPatch({ status: 'new', isPinned: true }, 'hide', NOW)).toEqual({ status: 'hidden', isPinned: false });
    expect(moderationPatch({ status: 'new', isPinned: false }, 'park', NOW)).toEqual({ status: 'parked' });
    expect(moderationPatch({ status: 'new', isPinned: false }, 'pin', NOW)).toEqual({ isPinned: true });
    expect(moderationPatch({ status: 'new', isPinned: true }, 'unpin', NOW)).toEqual({ isPinned: false });
  });

  it('unhide restores an answered question as answered, keeping its answer time', () => {
    const answeredAt = '2026-11-20T08:30:00.000Z';
    const hidden = { status: 'answered' as const, isPinned: false, answeredAt, ...moderationPatch({ status: 'answered', isPinned: false, answeredAt }, 'hide', NOW) };
    expect(hidden).toEqual({ status: 'hidden', isPinned: false, answeredAt });
    expect(moderationPatch(hidden, 'unhide', NOW)).toEqual({ status: 'answered' });
  });

  it('refuses actions that do not fit the state', () => {
    expect(() => moderationPatch({ status: 'hidden', isPinned: false }, 'answer', NOW)).toThrow(/does not apply/);
    expect(() => moderationPatch({ status: 'answered', isPinned: false }, 'pin', NOW)).toThrow(/does not apply/);
  });
});

describe('stable live list', () => {
  it('shows everything on first load', () => {
    expect(stabiliseOrder(null, ['a', 'b'])).toEqual({ order: ['a', 'b'], pending: [] });
  });

  it('keeps on-screen positions, drops gone rows and holds new rows back', () => {
    expect(stabiliseOrder(['a', 'b', 'c'], ['n1', 'c', 'a', 'n2'])).toEqual({ order: ['a', 'c'], pending: ['n1', 'n2'] });
  });

  it('labels the pill', () => {
    expect(newQuestionsLabel(1)).toBe('1 new question');
    expect(newQuestionsLabel(3)).toBe('3 new questions');
  });
});

describe('wrap-up markdown', () => {
  const session: QaSession = {
    id: 's1',
    title: 'Designing AI Agents',
    code: 'AGENTS',
    hostSub: 'host',
    hostName: 'Jordan Lee',
    status: 'closed',
    allowAnonymous: true,
    createdAt: '2026-11-20T08:00:00.000Z',
    closedAt: '2026-11-20T09:30:00.000Z',
  };

  it('lists answered and unanswered, keeps anonymous anonymous and leaves hidden out', () => {
    const list = [
      q('a', { text: 'Answered one', status: 'answered', answeredAt: '2026-11-20T08:30:00Z' }),
      q('b', { text: 'Still open\nwith a newline', isAnonymous: true, authorName: 'Secret Name' }),
      q('c', { text: 'Parked one', status: 'parked' }),
      q('h', { text: 'Spam', status: 'hidden' }),
    ];
    const md = wrapUpMarkdown(session, list, new Map([['b', 2], ['a', 1]]));
    expect(md).toContain('# Designing AI Agents: Q&A wrap-up');
    expect(md).toContain('Code AGENTS · Host Jordan Lee · 2026-11-20 · closed 2026-11-20');
    expect(md).toContain('## Answered (1)');
    expect(md).toContain('1. Answered one — Ana · 1 vote');
    expect(md).toContain('## Not answered (2)');
    expect(md).toContain('1. Still open with a newline — Anonymous · 2 votes');
    expect(md).toContain('2. Parked one — Ana · 0 votes');
    expect(md).not.toContain('Secret Name');
    expect(md).not.toContain('Spam');
  });

  it('handles an empty session', () => {
    const md = wrapUpMarkdown(session, [], new Map());
    expect(md).toContain('0 questions, 0 answered, 0 not answered.');
    expect(md).toContain('_None._');
  });
});
