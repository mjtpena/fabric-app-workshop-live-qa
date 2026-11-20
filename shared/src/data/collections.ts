/** Keep the newest row per key. `at` returns a sortable timestamp (ISO string or number). */
export function latestBy<T>(rows: T[], key: (r: T) => string, at: (r: T) => string | number): T[] {
  const best = new Map<string, T>();
  for (const r of rows) {
    const k = key(r);
    const cur = best.get(k);
    if (!cur || at(r) > at(cur)) best.set(k, r);
  }
  return [...best.values()];
}

export function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = m.get(k);
    if (list) list.push(r);
    else m.set(k, [r]);
  }
  return m;
}

export function countBy<T>(rows: T[], key: (r: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = key(r);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

export function uniqueBy<T>(rows: T[], key: (r: T) => string): T[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const k = key(r);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
