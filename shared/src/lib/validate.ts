/**
 * Client-side validation that mirrors the `@text({ min, max })` decorator limits on the entities.
 * Keep the numbers in one `limits` object per app and use it in both the entity class and the form.
 */
export interface TextRule {
  min?: number;
  max: number;
  optional?: boolean;
  label?: string;
}

export function checkText(value: string | null | undefined, rule: TextRule): string | null {
  const v = (value ?? '').trim();
  const label = rule.label ?? 'This field';
  if (!v) return rule.optional ? null : `${label} is required.`;
  if (rule.min && v.length < rule.min) return `${label} needs at least ${rule.min} characters.`;
  if (v.length > rule.max) return `${label} must be ${rule.max} characters or fewer (now ${v.length}).`;
  return null;
}

export type Errors<T> = Partial<Record<keyof T, string>>;

/** Run a rule per field; returns only the failing fields. */
export function validate<T extends Record<string, unknown>>(
  values: T,
  rules: Partial<Record<keyof T, (v: unknown, all: T) => string | null>>,
): Errors<T> {
  const out: Errors<T> = {};
  for (const key of Object.keys(rules) as (keyof T)[]) {
    const msg = rules[key]?.(values[key], values);
    if (msg) out[key] = msg;
  }
  return out;
}

export const hasErrors = (e: object) => Object.values(e).some(Boolean);

export function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}
