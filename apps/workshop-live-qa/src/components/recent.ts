/**
 * Sessions this browser joined recently, so an attendee can get back to the board from the sessions hub.
 * Per-viewer convenience only: a missing or blocked localStorage simply means an empty list.
 */
import type { QaSession } from '../model';

const KEY = 'x10:workshop-live-qa:recent:v1';
const MAX = 5;

export interface RecentSession {
  code: string;
  title: string;
  hostName: string;
  at: string;
}

export function recentSessions(): RecentSession[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as RecentSession[]) : [];
    return Array.isArray(list) ? list.filter((r) => r && typeof r.code === 'string').slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function rememberSession(s: Pick<QaSession, 'code' | 'title' | 'hostName'>) {
  try {
    const next = [{ code: s.code, title: s.title, hostName: s.hostName, at: new Date().toISOString() }, ...recentSessions().filter((r) => r.code !== s.code)];
    localStorage.setItem(KEY, JSON.stringify(next.slice(0, MAX)));
  } catch {
    // Storage blocked (private window, policy): nothing to remember.
  }
}
