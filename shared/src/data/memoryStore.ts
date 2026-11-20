import { readRow } from './normalize';
import {
  NotFoundError,
  type BaseRow,
  type CreateInput,
  type DataStore,
  type EntityDef,
  type EntityDefs,
  type ListOptions,
  type Repo,
  type UpdateInput,
} from './types';

type Tables = Record<string, Record<string, unknown>[]>;

export interface MemoryStoreOptions {
  /** localStorage key. When set, data persists across reloads and is shared between tabs of one browser profile. */
  storageKey?: string;
  /** Artificial latency per call in ms, so loading states are visible in demo mode. Default 0. */
  latencyMs?: number;
  /** Rows to start with when nothing is stored yet. */
  initial?: Tables;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

/**
 * In-memory implementation of `DataStore`, used for the offline demo mode, unit tests and Playwright.
 * It applies the same field normalisation as the Rayfin store so the two behave alike.
 * It does not enforce row-level security: the apps' domain functions check permissions in both modes.
 */
export function createMemoryStore<S>(defs: EntityDefs<S>, opts: MemoryStoreOptions = {}): DataStore<S> & {
  dump(): Tables;
  reset(tables?: Tables): void;
} {
  let memory: Tables = structuredClone(opts.initial ?? {});

  const load = (): Tables => {
    if (!opts.storageKey) return memory;
    try {
      const raw = globalThis.localStorage?.getItem(opts.storageKey);
      if (raw) memory = JSON.parse(raw) as Tables;
    } catch {
      /* storage unavailable: keep memory */
    }
    return memory;
  };
  const save = (tables: Tables) => {
    memory = tables;
    if (!opts.storageKey) return;
    try {
      globalThis.localStorage?.setItem(opts.storageKey, JSON.stringify(tables));
    } catch {
      /* storage full or unavailable: memory still holds the data */
    }
  };
  if (opts.storageKey) {
    try {
      if (!globalThis.localStorage?.getItem(opts.storageKey)) save(memory);
    } catch {
      /* ignore */
    }
  }

  const wait = () =>
    opts.latencyMs ? new Promise((r) => setTimeout(r, opts.latencyMs)) : Promise.resolve();

  function repo<T extends BaseRow>(name: string): Repo<T> {
    const def = (defs as unknown as Record<string, EntityDef>)[name];
    if (!def) throw new Error(`Unknown entity "${name}".`);
    const fields = def.fields;
    const norm = (r: Record<string, unknown>) => readRow(fields, r) as unknown as T;

    return {
      async list(o: ListOptions<T> = {}) {
        await wait();
        let rows = (load()[name] ?? []).map(norm);
        if (o.where) {
          const entries = Object.entries(o.where);
          rows = rows.filter((r) =>
            entries.every(([k, v]) => {
              const have = (r as Record<string, unknown>)[k];
              return v === null || v === undefined ? have === null || have === undefined : have === v;
            }),
          );
        }
        if (o.orderBy) {
          const { field, dir = 'asc' } = o.orderBy;
          rows.sort((a, b) => compare(a[field], b[field]) * (dir === 'desc' ? -1 : 1));
        }
        return rows.slice(0, o.limit ?? 2000);
      },
      async get(id) {
        await wait();
        const row = (load()[name] ?? []).find((r) => r.id === id);
        return row ? norm(row) : null;
      },
      async create(data: CreateInput<T>) {
        await wait();
        const tables = load();
        for (const k of Object.keys(data)) {
          if (!(k in fields)) throw new Error(`Unknown field "${k}" on ${name}.`);
        }
        const row = { ...data, id: data.id ?? newId() } as Record<string, unknown>;
        const stored = norm(row) as unknown as Record<string, unknown>;
        save({ ...tables, [name]: [...(tables[name] ?? []), stored] });
        return stored as unknown as T;
      },
      async update(id: string, patch: UpdateInput<T>) {
        await wait();
        const tables = load();
        const rows = tables[name] ?? [];
        const idx = rows.findIndex((r) => r.id === id);
        if (idx < 0) throw new NotFoundError(name, id);
        for (const k of Object.keys(patch)) {
          if (!(k in fields)) throw new Error(`Unknown field "${k}" on ${name}.`);
        }
        const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
        const next = norm({ ...rows[idx], ...clean }) as unknown as Record<string, unknown>;
        const copy = [...rows];
        copy[idx] = next;
        save({ ...tables, [name]: copy });
        return next as unknown as T;
      },
      async remove(id: string) {
        await wait();
        const tables = load();
        save({ ...tables, [name]: (tables[name] ?? []).filter((r) => r.id !== id) });
      },
    };
  }

  return {
    kind: 'memory',
    repo: repo as DataStore<S>['repo'],
    dump: () => structuredClone(load()),
    reset: (tables: Tables = {}) => save(structuredClone(tables)),
  };
}
