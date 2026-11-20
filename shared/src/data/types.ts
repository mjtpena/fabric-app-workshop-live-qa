/**
 * Data-store contract shared by every app.
 *
 * Apps write their domain logic against `DataStore`, never against the Rayfin client directly, so the same code runs
 * against the in-memory demo store (local dev, Vitest, Playwright, demo recordings) and the Rayfin GraphQL store
 * (deployed to Fabric). Dates cross this boundary as ISO-8601 UTC strings; booleans as booleans; numbers as numbers.
 */

/** Wire kind of a field, mirroring the Rayfin decorator used on the entity class. */
export type FieldKind = 'uuid' | 'text' | 'int' | 'decimal' | 'bool' | 'date' | 'set';

/** Field kinds of one entity, keyed by property name. Must list every column the app reads or writes. */
export type FieldMap = Record<string, FieldKind>;

/** Runtime description of one Rayfin entity. `name` is the entity class name (GraphQL type name). */
export interface EntityDef {
  name: string;
  fields: FieldMap;
}

/** Map of entity name to its definition. Keys must equal `EntityDef.name`. */
export type EntityDefs<S> = { [K in keyof S]: EntityDef };

export interface BaseRow {
  id: string;
}

/** Equality filter. Values are compared exactly; `null` matches a missing value. */
export type Where<T> = { [K in keyof T]?: T[K] | null };

export interface ListOptions<T> {
  where?: Where<T>;
  orderBy?: { field: keyof T & string; dir?: 'asc' | 'desc' };
  /** Upper bound on rows returned. Defaults to 2000, which is far above any app's expected volume. */
  limit?: number;
}

export type CreateInput<T extends BaseRow> = Omit<T, 'id'> & { id?: string };
export type UpdateInput<T extends BaseRow> = Partial<Omit<T, 'id'>>;

export interface Repo<T extends BaseRow> {
  list(opts?: ListOptions<T>): Promise<T[]>;
  get(id: string): Promise<T | null>;
  /** Insert a row and return it as stored (with its id). */
  create(data: CreateInput<T>): Promise<T>;
  /** Patch a row and return the stored result. Throws `NotFoundError` when the row is gone. */
  update(id: string, patch: UpdateInput<T>): Promise<T>;
  remove(id: string): Promise<void>;
}

export interface DataStore<S> {
  readonly kind: 'memory' | 'rayfin';
  repo<K extends keyof S & string>(name: K): Repo<S[K] & BaseRow>;
}

export class NotFoundError extends Error {
  readonly category = 'not_found';
  constructor(entity: string, id: string) {
    super(`${entity} ${id} was not found. It may have been deleted.`);
    this.name = 'NotFoundError';
  }
}

/** Thrown by domain functions when a rule refuses an action. The message is shown to the user as-is. */
export class RuleError extends Error {
  readonly category = 'validation';
  constructor(message: string) {
    super(message);
    this.name = 'RuleError';
  }
}

/** Thrown by domain functions when the viewer may not perform an action. */
export class PermissionError extends Error {
  readonly category = 'permission';
  constructor(message: string) {
    super(message);
    this.name = 'PermissionError';
  }
}
