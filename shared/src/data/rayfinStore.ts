import { readRow, writeRow, writeValue } from './normalize';
import {
  NotFoundError,
  type BaseRow,
  type CreateInput,
  type DataStore,
  type EntityDefs,
  type FieldMap,
  type ListOptions,
  type Repo,
  type UpdateInput,
} from './types';

/** The slice of the Rayfin fluent data client this store uses. Kept structural so tests can fake it. */
export interface FluentQuery {
  where(filter: Record<string, unknown>): FluentQuery;
  orderBy(order: Record<string, 'asc' | 'desc'>): FluentQuery;
  first(n: number): FluentQuery;
  after(cursor: string): FluentQuery;
  executePaginated(): Promise<{ items: Record<string, unknown>[]; endCursor?: string | null; hasNextPage: boolean }>;
}

export interface FluentEntity {
  select(fields: string[]): FluentQuery;
  create(data: Record<string, unknown>): Promise<Record<string, unknown>>;
  update(key: { id: string }, patch: Record<string, unknown>): Promise<unknown>;
  delete(key: { id: string }): Promise<unknown>;
}

export interface RayfinDataLike {
  data: Record<string, FluentEntity>;
}

const PAGE = 500;

/** How long one SDK call may take before the UI gets an error instead of a spinner that never ends. */
export const REQUEST_TIMEOUT_MS = 60_000;

/** Reject with a `TIMEOUT` error if `p` has not settled within `ms`. A late result is ignored. */
export function withTimeout<T>(p: Promise<T>, ms: number, write: boolean): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const secs = Math.round(ms / 1000);
      const err = new Error(
        write
          ? `Fabric did not confirm the change within ${secs} seconds. It may still have been saved: refresh to check before trying again.`
          : `Fabric did not answer within ${secs} seconds. The capacity may be busy; try again in a moment.`,
      ) as Error & { code: string };
      err.code = 'TIMEOUT';
      reject(err);
    }, ms);
  });
  return Promise.race([p, late]).finally(() => clearTimeout(timer));
}

/**
 * `DataStore` backed by the Rayfin GraphQL fluent client (`client.data.<Entity>`).
 * Lists page through results with `.first(n).executePaginated()` so nothing is silently truncated at 100 rows.
 */
export function createRayfinStore<S>(client: RayfinDataLike, defs: EntityDefs<S>, timeoutMs = REQUEST_TIMEOUT_MS): DataStore<S> {
  function repo<T extends BaseRow>(name: string): Repo<T> {
    const fields: FieldMap | undefined = (defs as Record<string, { fields: FieldMap }>)[name]?.fields;
    if (!fields) throw new Error(`Unknown entity "${name}".`);
    const entity = () => {
      const e = client.data[name];
      if (!e) throw new Error(`Entity "${name}" is not registered in rayfin/data/schema.ts.`);
      return e;
    };
    const columns = Object.keys(fields);
    const norm = (r: Record<string, unknown>) => readRow(fields, r) as unknown as T;

    async function list(o: ListOptions<T> = {}): Promise<T[]> {
      const limit = o.limit ?? 2000;
      const filter: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(o.where ?? {})) {
        const kind = fields![k];
        if (!kind) throw new Error(`Unknown filter field "${k}" on ${name}.`);
        filter[k] = v === null || v === undefined ? { isNull: true } : { eq: writeValue(kind, v) };
      }
      const out: T[] = [];
      let cursor: string | null | undefined;
      do {
        let q = entity().select(columns);
        if (Object.keys(filter).length) q = q.where(filter);
        // A stable order is required for cursor paging; fall back to id.
        q = q.orderBy(o.orderBy ? { [o.orderBy.field]: o.orderBy.dir ?? 'asc' } : { id: 'asc' });
        q = q.first(Math.min(PAGE, limit - out.length));
        if (cursor) q = q.after(cursor);
        const page = await withTimeout(q.executePaginated(), timeoutMs, false);
        out.push(...page.items.map(norm));
        cursor = page.hasNextPage ? page.endCursor : null;
      } while (cursor && out.length < limit);
      return out;
    }

    async function get(id: string): Promise<T | null> {
      const rows = await list({ where: { id } as never, limit: 1 });
      return rows[0] ?? null;
    }

    return {
      list,
      get,
      async create(data: CreateInput<T>) {
        const { id: _ignored, ...rest } = data as Record<string, unknown>;
        void _ignored;
        const created = await withTimeout(entity().create(writeRow(fields, rest)), timeoutMs, true);
        const id = created?.id as string | undefined;
        if (!id) return norm({ ...rest, ...(created ?? {}) });
        return (await get(id)) ?? norm({ ...rest, ...created });
      },
      async update(id: string, patch: UpdateInput<T>) {
        await withTimeout(entity().update({ id }, writeRow(fields, patch as Record<string, unknown>)), timeoutMs, true);
        const row = await get(id);
        if (!row) throw new NotFoundError(name, id);
        return row;
      },
      async remove(id: string) {
        await withTimeout(entity().delete({ id }), timeoutMs, true);
      },
    };
  }

  return { kind: 'rayfin', repo: repo as DataStore<S>['repo'] };
}
