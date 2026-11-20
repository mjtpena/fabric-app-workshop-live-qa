/** Time helpers. All maths uses UTC milliseconds; formatting uses the viewer's locale and time zone. */

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export function toMs(iso: string | Date): number {
  return iso instanceof Date ? iso.getTime() : new Date(iso).getTime();
}

export function addDays(iso: string | Date, days: number): string {
  return new Date(toMs(iso) + days * DAY).toISOString();
}

export function addMinutes(iso: string | Date, minutes: number): string {
  return new Date(toMs(iso) + minutes * MINUTE).toISOString();
}

/** Whole minutes from `a` to `b` (negative when b is earlier). */
export function minutesBetween(a: string | Date, b: string | Date): number {
  return Math.round((toMs(b) - toMs(a)) / MINUTE);
}

/** Start of the UTC day containing `iso`. */
export function utcDay(iso: string | Date): number {
  const d = new Date(toMs(iso));
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Calendar days from `a` to `b`, counted on UTC day boundaries. */
export function daysBetween(a: string | Date, b: string | Date): number {
  return Math.round((utcDay(b) - utcDay(a)) / DAY);
}

const dateFmt = () => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const dateTimeFmt = () => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ms = toMs(iso);
  return Number.isNaN(ms) ? '—' : dateFmt().format(ms);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ms = toMs(iso);
  return Number.isNaN(ms) ? '—' : dateTimeFmt().format(ms);
}

/** "3 min ago", "in 2 days". */
export function formatRelative(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '—';
  const diff = toMs(iso) - now.getTime();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (abs < MINUTE) return rtf.format(Math.round(diff / 1000), 'second');
  if (abs < HOUR) return rtf.format(Math.round(diff / MINUTE), 'minute');
  if (abs < DAY) return rtf.format(Math.round(diff / HOUR), 'hour');
  if (abs < 30 * DAY) return rtf.format(Math.round(diff / DAY), 'day');
  if (abs < 365 * DAY) return rtf.format(Math.round(diff / (30 * DAY)), 'month');
  return rtf.format(Math.round(diff / (365 * DAY)), 'year');
}

/** "1 h 5 min", "45 min", "2 d 3 h". */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return '—';
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  if (m < 60 * 24) {
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? `${h} h ${r} min` : `${h} h`;
  }
  const d = Math.floor(m / (60 * 24));
  const h = Math.floor((m % (60 * 24)) / 60);
  return h ? `${d} d ${h} h` : `${d} d`;
}

/** Value for an <input type="datetime-local"> from an ISO string, in local time. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** ISO string from an <input type="datetime-local"> value (interpreted in local time). */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Value for an <input type="date"> (local calendar date). */
export function toDateInput(iso: string | null | undefined): string {
  return toLocalInput(iso).slice(0, 10);
}

/** ISO string at local midnight from an <input type="date"> value. */
export function fromDateInput(value: string): string | null {
  return value ? fromLocalInput(`${value}T00:00`) : null;
}
