/**
 * Accent and light/dark theme on <html>. The accent comes from AppConfig; the theme preference is per browser
 * (shared by all apps on the origin) and defaults to the system setting.
 */
import { useEffect, useState } from 'react';

import { ACCENTS, type AccentName } from '../ui/palette';

/** Accent per app from docs/DESIGN.md §3, used when an AppConfig does not set `accent`. */
export const DEFAULT_ACCENTS: Record<string, AccentName> = {
  'measure-unit-tests': 'indigo',
  'keep-or-kill': 'ember',
  'data-contract-handshake': 'blue',
  'metric-dictionary': 'plum',
  'postmortem-pad': 'amber',
  'workshop-live-qa': 'violet',
  'cohort-pulse': 'coral',
  'request-triage': 'teal',
  'endorsement-queue': 'gold',
  'model-explainer': 'cyan',
};

export function resolveAccent(appId: string, accent?: string): AccentName {
  if (accent && (ACCENTS as readonly string[]).includes(accent)) return accent as AccentName;
  return DEFAULT_ACCENTS[appId] ?? 'indigo';
}

export function applyAccent(accent: AccentName) {
  if (typeof document !== 'undefined') document.documentElement.dataset.accent = accent;
}

export type ThemePref = 'system' | 'light' | 'dark';
const KEY = 'x10:theme';
const listeners = new Set<(t: ThemePref) => void>();

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(pref: ThemePref) {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  if (pref === 'system') delete el.dataset.theme;
  else el.dataset.theme = pref;
}

export function setThemePref(pref: ThemePref) {
  try {
    if (pref === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    /* storage blocked: still apply for this page */
  }
  applyTheme(pref);
  listeners.forEach((l) => l(pref));
}

/** Current theme preference and a setter (System / Light / Dark). */
export function useThemePref(): [ThemePref, (t: ThemePref) => void] {
  const [pref, setPref] = useState<ThemePref>(getThemePref);
  useEffect(() => {
    listeners.add(setPref);
    return () => void listeners.delete(setPref);
  }, []);
  return [pref, setThemePref];
}
