import { createMemoryStore } from './memoryStore';
import { createRayfinStore, withTimeout, type FluentEntity, type FluentQuery } from './rayfinStore';
import type { EntityDefs } from './types';

interface Thing {
  id: string;
  name: string;
  count: number;
  done: boolean;
  at: string;
  note: string | null;
}
type S = { Thing: Thing };
const defs: EntityDefs<S> = {
  Thing: { name: 'Thing', fields: { id: 'uuid', name: 'text', count: 'int', done: 'bool', at: 'date', note: 'text' } },
};

describe('memory store', () => {
  it('creates, lists with filters and order, updates and removes', async () => {
    const s = createMemoryStore<S>(defs);
    const r = s.repo('Thing');
    const a = await r.create({ name: 'b', count: 2, done: false, at: '2026-01-02T00:00:00Z', note: null });
    await r.create({ name: 'a', count: 1, done: true, at: '2026-01-01T00:00:00Z', note: 'x' });
    expect(a.id).toMatch(/[0-9a-f-]{36}/);
    expect(a.at).toBe('2026-01-02T00:00:00.000Z');
    expect((await r.list({ orderBy: { field: 'name' } })).map((t) => t.name)).toEqual(['a', 'b']);
    expect((await r.list({ where: { done: true } })).map((t) => t.name)).toEqual(['a']);
    expect((await r.list({ where: { note: null } })).map((t) => t.name)).toEqual(['b']);
    const u = await r.update(a.id, { count: 5 });
    expect(u.count).toBe(5);
    await r.remove(a.id);
    expect(await r.get(a.id)).toBeNull();
  });

  it('rejects unknown fields and missing rows', async () => {
    const r = createMemoryStore<S>(defs).repo('Thing');
    await expect(r.create({ name: 'x', count: 1, done: false, at: '2026-01-01T00:00:00Z', note: null, bogus: 1 } as never)).rejects.toThrow(/Unknown field/);
    await expect(r.update('nope', { count: 1 })).rejects.toThrow(/not found/);
  });

  it('persists to localStorage and is shared by two store instances', async () => {
    localStorage.clear();
    const one = createMemoryStore<S>(defs, { storageKey: 'k' });
    const two = createMemoryStore<S>(defs, { storageKey: 'k' });
    await one.repo('Thing').create({ name: 'shared', count: 1, done: false, at: '2026-01-01T00:00:00Z', note: null });
    expect((await two.repo('Thing').list()).map((t) => t.name)).toEqual(['shared']);
  });
});

describe('rayfin store', () => {
  function fakeClient(rows: Record<string, unknown>[]) {
    const calls: { where?: unknown; order?: unknown; first?: number; after?: string }[] = [];
    const entity: FluentEntity = {
      select() {
        const call: (typeof calls)[number] = {};
        calls.push(call);
        const q: FluentQuery = {
          where(f) {
            call.where = f;
            return q;
          },
          orderBy(o) {
            call.order = o;
            return q;
          },
          first(n) {
            call.first = n;
            return q;
          },
          after(c) {
            call.after = c;
            return q;
          },
          async executePaginated() {
            const start = call.after ? Number(call.after) : 0;
            const items = rows.slice(start, start + (call.first ?? 100));
            const end = start + items.length;
            return { items, endCursor: String(end), hasNextPage: end < rows.length };
          },
        };
        return q;
      },
      async create(d) {
        rows.push({ ...d, id: 'new-id' });
        return { id: 'new-id' };
      },
      async update() {
        return {};
      },
      async delete() {
        return {};
      },
    };
    return { client: { data: { Thing: entity } }, calls };
  }

  it('pages until exhausted and normalises wire values', async () => {
    const rows = Array.from({ length: 1200 }, (_, i) => ({
      id: `id-${i}`,
      name: `n${i}`,
      count: String(i),
      done: i % 2 ? 'true' : 'false',
      at: new Date(Date.UTC(2026, 0, 1)),
      note: null,
    }));
    const { client, calls } = fakeClient(rows);
    const list = await createRayfinStore<S>(client, defs).repo('Thing').list();
    expect(list).toHaveLength(1200);
    expect(calls.length).toBe(3);
    expect(list[1]).toMatchObject({ count: 1, done: true, at: '2026-01-01T00:00:00.000Z', note: null });
  });

  it('translates equality and null filters', async () => {
    const { client, calls } = fakeClient([]);
    await createRayfinStore<S>(client, defs).repo('Thing').list({ where: { name: 'x', note: null }, orderBy: { field: 'name', dir: 'desc' } });
    expect(calls[0].where).toEqual({ name: { eq: 'x' }, note: { isNull: true } });
    expect(calls[0].order).toEqual({ name: 'desc' });
  });

  it('create drops a client-side id and re-reads the stored row', async () => {
    const { client } = fakeClient([]);
    const t = await createRayfinStore<S>(client, defs)
      .repo('Thing')
      .create({ id: 'ignored', name: 'n', count: 1, done: false, at: '2026-01-01T00:00:00Z', note: null });
    expect(t.id).toBe('new-id');
  });
});

describe('withTimeout', () => {
  it('passes a result through when the call settles in time', async () => {
    await expect(withTimeout(Promise.resolve(7), 1000, false)).resolves.toBe(7);
  });

  it('rejects a read that never settles with a TIMEOUT error', async () => {
    const err = (await withTimeout(new Promise(() => {}), 20, false).catch((e: unknown) => e)) as Error & { code: string };
    expect(err.code).toBe('TIMEOUT');
    expect(err.message).toMatch(/did not answer within/);
  });

  it('tells the user a timed-out write may still have been saved', async () => {
    const err = (await withTimeout(new Promise(() => {}), 20, true).catch((e: unknown) => e)) as Error & { code: string };
    expect(err.code).toBe('TIMEOUT');
    expect(err.message).toMatch(/may still have been saved/);
  });
});
