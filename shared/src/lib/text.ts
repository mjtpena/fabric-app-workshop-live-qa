/** Lowercase words of 2+ characters, for search and similarity. */
export function tokens(s: string): string[] {
  return (s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((w) => w.length > 1);
}

/** Normalise for case- and space-insensitive comparison: trim, collapse spaces, lowercase. */
export function normKey(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function truncate(s: string | null | undefined, n: number): string {
  const v = (s ?? '').trim();
  return v.length > n ? `${v.slice(0, n - 1).trimEnd()}…` : v;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function pct(part: number, whole: number, digits = 0): string {
  if (!whole) return '0%';
  return `${((part / whole) * 100).toFixed(digits)}%`;
}

/** Split a comma list ("a, b ,c") into trimmed, non-empty items. */
export function commaList(s: string | null | undefined): string[] {
  return (s ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Median of numbers; null for an empty list. */
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
