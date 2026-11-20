import { FIXED_NOW, testStore } from '@x10/shared/test';
import type { Person } from '@x10/shared/identity';

import { personas } from '../app.config';
import { defs } from '../model';
import { DEMO_CODES, seed } from '../seed';
import { askQuestion, editQuestionText, moderateQuestion, toggleUpvote, withdrawQuestion } from './questions';
import { closeSession, createSession, findSessionByCode, listMySessions, loadBoard, resolveJoin } from './sessions';

async function setup() {
  const store = await testStore(defs, { personas, fn: seed, now: FIXED_NOW });
  const people = await store.repo('Person').list();
  const by = (sub: string) => people.find((p) => p.sub === sub) as Person;
  return { store, host: by('demo-host'), ana: by('demo-ana'), ben: by('demo-ben'), chloe: by('demo-chloe') };
}

const later = (s: number) => new Date(FIXED_NOW.getTime() + s * 1000);

describe('seed', () => {
  it('has the two sessions the spec asks for, with 14 questions and 40 upvotes in the live one', async () => {
    const { store, host } = await setup();
    const live = await loadBoard(store, host, DEMO_CODES.live);
    expect(live?.session.title).toBe('Designing AI Agents (demo)');
    expect(live?.session.status).toBe('open');
    expect(live?.questions).toHaveLength(14);
    expect(live?.upvotes).toHaveLength(40);
    expect(new Set(live?.questions.map((q) => q.status))).toEqual(new Set(['new', 'answered', 'parked', 'hidden']));
    expect(live?.questions.some((q) => q.isAnonymous)).toBe(true);
    const closed = await findSessionByCode(store, DEMO_CODES.closed);
    expect(closed?.status).toBe('closed');
    expect(closed?.closedAt).not.toBeNull();
  });

  it('is idempotent', async () => {
    const { store } = await setup();
    const { runSeed } = await import('@x10/shared/runtime');
    expect(await runSeed(store, personas, seed, FIXED_NOW)).toBe(false);
    expect(await store.repo('QaSession').list()).toHaveLength(2);
  });

  it('leaves Ben one question short of the limit', async () => {
    const { store, ben } = await setup();
    const board = await loadBoard(store, ben, DEMO_CODES.live);
    expect(board?.myOpenCount).toBe(4);
  });
});

describe('joining', () => {
  it('resolves open, closed, unknown and malformed codes', async () => {
    const { store } = await setup();
    expect((await resolveJoin(store, 'agents')).kind).toBe('open');
    expect((await resolveJoin(store, 'LAKE25')).kind).toBe('closed');
    expect((await resolveJoin(store, 'ZZZZZZ')).kind).toBe('unknown');
    expect((await resolveJoin(store, 'nope')).kind).toBe('invalid');
  });

  it('hides hidden questions from attendees but not from the host', async () => {
    const { store, host, ana } = await setup();
    expect((await loadBoard(store, ana, 'AGENTS'))?.questions).toHaveLength(13);
    expect((await loadBoard(store, host, 'AGENTS'))?.questions).toHaveLength(14);
    expect(await loadBoard(store, ana, 'ZZZZZZ')).toBeNull();
  });
});

describe('sessions', () => {
  it('lets an admin create a session with a unique code and refuses non-admins', async () => {
    const { store, host, ana } = await setup();
    await expect(createSession(store, ana, false, { title: 'My session', allowAnonymous: true })).rejects.toThrow(/Only hosts/);
    await expect(createSession(store, host, true, { title: 'ab', allowAnonymous: true })).rejects.toThrow(/at least 3/);
    // The first two codes collide with the seeded ones; the third is free.
    const codes = ['AGENTS', 'LAKE25', 'NEW234'];
    let call = 0;
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const seq = codes.flatMap((c) => [...c].map((ch) => (alphabet.indexOf(ch) + 0.5) / alphabet.length));
    const random = () => seq[call++];
    const s = await createSession(store, host, true, { title: '  Data clinic  ', allowAnonymous: false }, FIXED_NOW, random);
    expect(s.code).toBe('NEW234');
    expect(s.title).toBe('Data clinic');
    expect(s.status).toBe('open');
    expect(s.closedAt).toBeNull();
    const mine = await listMySessions(store, host);
    expect(mine[0].session.code).toBe('NEW234');
    expect(mine[0].questions).toBe(0);
    const agents = mine.find((m) => m.session.code === 'AGENTS');
    expect(agents?.questions).toBe(13);
    expect(agents?.answered).toBe(3);
  });

  it('only the host closes a session, and a closed session is read-only', async () => {
    const { store, host, ana } = await setup();
    const s = (await findSessionByCode(store, 'AGENTS'))!;
    await expect(closeSession(store, ana, s.id)).rejects.toThrow(/Only the host/);
    const closed = await closeSession(store, host, s.id, later(60));
    expect(closed.status).toBe('closed');
    expect(closed.closedAt).toBe(later(60).toISOString());
    await expect(askQuestion(store, ana, s.id, { text: 'Too late?', anonymous: false })).rejects.toThrow(/closed/);
    const board = await loadBoard(store, ana, 'AGENTS');
    const target = board!.questions.find((q) => q.status === 'new' && q.authorSub !== ana.sub)!;
    await expect(toggleUpvote(store, ana, target.id)).rejects.toThrow(/closed/);
    await expect(moderateQuestion(store, host, target.id, 'answer')).rejects.toThrow(/closed/);
  });
});

describe('asking', () => {
  it('accepts the fifth unanswered question and refuses the sixth by re-checking the database', async () => {
    const { store, ben } = await setup();
    const s = (await findSessionByCode(store, 'AGENTS'))!;
    const fifth = await askQuestion(store, ben, s.id, { text: 'Fifth question from Ben', anonymous: false }, later(1));
    expect(fifth.status).toBe('new');
    expect(fifth.hostSub).toBe(s.hostSub);
    expect(fifth.answeredAt).toBeNull();
    await expect(askQuestion(store, ben, s.id, { text: 'Sixth question from Ben', anonymous: false })).rejects.toThrow(
      /5 unanswered questions/,
    );
  });

  it('frees a slot when the host answers one', async () => {
    const { store, ben, host } = await setup();
    const s = (await findSessionByCode(store, 'AGENTS'))!;
    const fifth = await askQuestion(store, ben, s.id, { text: 'Fifth question from Ben', anonymous: false });
    await moderateQuestion(store, host, fifth.id, 'answer');
    await expect(askQuestion(store, ben, s.id, { text: 'Now there is room', anonymous: false })).resolves.toBeTruthy();
  });

  it('validates text, anonymity and the host', async () => {
    const { store, ana, host } = await setup();
    const live = (await findSessionByCode(store, 'AGENTS'))!;
    await expect(askQuestion(store, ana, live.id, { text: 'no', anonymous: false })).rejects.toThrow(/at least 3/);
    await expect(askQuestion(store, host, live.id, { text: 'Host question', anonymous: false })).rejects.toThrow(/You are the host/);
    const plain = await createSession(store, host, true, { title: 'Named only', allowAnonymous: false });
    await expect(askQuestion(store, ana, plain.id, { text: 'Can I hide?', anonymous: true })).rejects.toThrow(/does not allow anonymous/);
  });

  it('keeps anonymous questions anonymous on the stored row flag (the host still sees the name)', async () => {
    const { store, chloe } = await setup();
    const s = (await findSessionByCode(store, 'AGENTS'))!;
    const q = await askQuestion(store, chloe, s.id, { text: 'A shy question', anonymous: true });
    expect(q.isAnonymous).toBe(true);
    expect(q.authorName).toBe('Chloe Nguyen');
  });

  it('lets authors withdraw their own unanswered questions only', async () => {
    const { store, ana, ben } = await setup();
    const s = (await findSessionByCode(store, 'AGENTS'))!;
    const q = await askQuestion(store, ana, s.id, { text: 'Withdraw me later', anonymous: false });
    await toggleUpvote(store, ben, q.id);
    await expect(withdrawQuestion(store, ben, q.id)).rejects.toThrow(/only withdraw your own/);
    await withdrawQuestion(store, ana, q.id);
    const board = await loadBoard(store, ana, 'AGENTS');
    expect(board?.questions.find((x) => x.id === q.id)).toBeUndefined();
    // Ben's orphaned vote is ignored by the board.
    expect(board?.upvotes.some((u) => u.questionId === q.id)).toBe(false);
    const answered = board!.questions.find((x) => x.authorSub === ana.sub && x.status === 'answered')!;
    await expect(withdrawQuestion(store, ana, answered.id)).rejects.toThrow(/stay on the record/);
  });
});

describe('upvotes', () => {
  it('toggles on and off, one per person, and simultaneous voters both count', async () => {
    const { store, ana, ben, chloe } = await setup();
    const s = (await findSessionByCode(store, 'AGENTS'))!;
    const q = await askQuestion(store, chloe, s.id, { text: 'Vote on this one', anonymous: false });
    await Promise.all([toggleUpvote(store, ana, q.id), toggleUpvote(store, ben, q.id)]);
    let board = await loadBoard(store, ana, 'AGENTS');
    expect(board?.scores.get(q.id)).toBe(2);
    expect(board?.myVotes.has(q.id)).toBe(true);
    expect(await toggleUpvote(store, ana, q.id)).toBe(false);
    board = await loadBoard(store, ana, 'AGENTS');
    expect(board?.scores.get(q.id)).toBe(1);
    expect(board?.myVotes.has(q.id)).toBe(false);
  });

  it('refuses own questions, the host, and questions the host hid meanwhile', async () => {
    const { store, ana, host, chloe } = await setup();
    const s = (await findSessionByCode(store, 'AGENTS'))!;
    const q = await askQuestion(store, chloe, s.id, { text: 'Soon to be hidden', anonymous: false });
    await expect(toggleUpvote(store, chloe, q.id)).rejects.toThrow(/your own question/);
    await expect(toggleUpvote(store, host, q.id)).rejects.toThrow(/Hosts do not vote/);
    await moderateQuestion(store, host, q.id, 'hide');
    await expect(toggleUpvote(store, ana, q.id)).rejects.toThrow(/hidden this question/);
    await store.repo('Question').remove(q.id);
    await expect(toggleUpvote(store, ana, q.id)).rejects.toThrow(/no longer there/);
  });
});

describe('forged rows', () => {
  it('a question written through the API with a wrong hostSub never reaches any screen, nor do its votes', async () => {
    const { store, host, ana, ben } = await setup();
    const s = (await findSessionByCode(store, 'AGENTS'))!;
    // What a malicious attendee could insert directly via GraphQL (the create policy only forbids hostSub == self).
    const forged = await store.repo('Question').create({
      sessionId: s.id,
      text: 'Forged question the host cannot moderate',
      authorSub: ben.sub,
      authorName: ben.displayName,
      isAnonymous: false,
      isPinned: false,
      status: 'new',
      hostSub: 'x',
      createdAt: FIXED_NOW.toISOString(),
      answeredAt: null,
    });
    await store.repo('Upvote').create({ questionId: forged.id, sessionId: s.id, voterSub: ana.sub, createdAt: FIXED_NOW.toISOString() });
    for (const viewer of [host, ana]) {
      const board = (await loadBoard(store, viewer, 'AGENTS'))!;
      expect(board.questions.some((q) => q.id === forged.id)).toBe(false);
      expect(board.upvotes.some((u) => u.questionId === forged.id)).toBe(false);
      expect(board.upvotes).toHaveLength(40);
    }
    const mine = await listMySessions(store, host);
    expect(mine.find((m) => m.session.code === 'AGENTS')?.questions).toBe(13);
  });
});

describe('moderation', () => {
  it('hide then unhide brings an answered question back as answered', async () => {
    const { store, host } = await setup();
    const board = (await loadBoard(store, host, 'AGENTS'))!;
    const answered = board.questions.find((q) => q.status === 'answered')!;
    const hidden = await moderateQuestion(store, host, answered.id, 'hide');
    expect(hidden.status).toBe('hidden');
    expect(hidden.answeredAt).toBe(answered.answeredAt);
    const back = await moderateQuestion(store, host, answered.id, 'unhide');
    expect(back.status).toBe('answered');
    expect(back.answeredAt).toBe(answered.answeredAt);
    const fresh = board.questions.find((q) => q.status === 'new' && !q.isPinned)!;
    await moderateQuestion(store, host, fresh.id, 'hide');
    expect((await moderateQuestion(store, host, fresh.id, 'unhide')).status).toBe('new');
  });

  it('only the host moderates and edits', async () => {
    const { store, ana, host } = await setup();
    const board = (await loadBoard(store, host, 'AGENTS'))!;
    const target = board.questions.find((q) => q.status === 'new' && !q.isPinned)!;
    await expect(moderateQuestion(store, ana, target.id, 'answer')).rejects.toThrow(/Only the host/);
    await expect(editQuestionText(store, ana, target.id, 'Rewritten')).rejects.toThrow(/Only the host/);
    const pinned = await moderateQuestion(store, host, target.id, 'pin');
    expect(pinned.isPinned).toBe(true);
    const answered = await moderateQuestion(store, host, target.id, 'answer', later(5));
    expect(answered.status).toBe('answered');
    expect(answered.isPinned).toBe(false);
    expect(answered.answeredAt).toBe(later(5).toISOString());
    const edited = await editQuestionText(store, host, target.id, '  A clearer wording  ');
    expect(edited.text).toBe('A clearer wording');
    await expect(editQuestionText(store, host, target.id, 'x')).rejects.toThrow(/at least 3/);
    await expect(moderateQuestion(store, host, target.id, 'park')).rejects.toThrow(/does not apply/);
  });
});
