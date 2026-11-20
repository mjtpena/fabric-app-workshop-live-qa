import type { FieldKind, FieldMap } from './types';

/**
 * Convert a value read from the Rayfin client into the shape the apps use.
 * The client may return dates as `Date | string`, booleans as `boolean | 'true' | 'false'`,
 * and decimals as strings, so every read goes through here.
 */
export function readValue(kind: FieldKind, value: unknown): unknown {
  if (value === null || value === undefined) return null;
  switch (kind) {
    case 'date': {
      const d = value instanceof Date ? value : new Date(String(value));
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
    case 'bool':
      return value === true || value === 'true' || value === 1 || value === '1';
    case 'int':
    case 'decimal': {
      const n = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(n) ? n : null;
    }
    default:
      return typeof value === 'string' ? value : String(value);
  }
}

/** Convert an app value into what the Rayfin client expects on create/update and in filters. */
export function writeValue(kind: FieldKind, value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (kind === 'date') return value instanceof Date ? value : new Date(String(value));
  return value;
}

export function readRow(fields: FieldMap, raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, kind] of Object.entries(fields)) {
    out[name] = readValue(kind, raw[name]);
  }
  return out;
}

export function writeRow(fields: FieldMap, data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(data)) {
    const kind = fields[name];
    if (!kind) throw new Error(`Unknown field "${name}". Add it to the entity definition.`);
    if (value === undefined) continue;
    out[name] = writeValue(kind, value);
  }
  return out;
}
