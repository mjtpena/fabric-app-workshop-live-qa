import { createContext, useContext, type ReactNode } from 'react';

import type { DataStore, EntityDefs } from '../data/types';
import type { AppMarker, Person, Persona, Viewer } from '../identity';
import type { AccentName } from '../ui/palette';
import type { FabricClientOptions } from './fabric';
import type { SeedFn } from './seed';

export type AppMode = 'demo' | 'fabric';

export interface NavItem {
  to: string;
  label: string;
  adminOnly?: boolean;
  /** Match only the exact path (for "/"). */
  end?: boolean;
  /** Icon for the mobile tab bar (a lucide icon element). A sensible default is picked from the label. */
  icon?: ReactNode;
}

export interface AppConfig<S extends { Person: Person; AppMarker: AppMarker }> {
  /** Slug, such as "cohort-pulse". Used for storage keys and test ids. */
  appId: string;
  title: string;
  /** One-line description shown on the sign-in page. */
  tagline: string;
  defs: EntityDefs<S>;
  /** Fictional users for the offline demo mode. The first one is the default viewer. */
  personas: Persona[];
  seed: SeedFn<S>;
  nav: NavItem[];
  /** Fabric client options (connectors, data off). */
  fabric?: FabricClientOptions;
  /** The app's accent ramp. Defaults to the accent assigned to the appId in docs/DESIGN.md, else indigo. */
  accent?: AccentName;
  /**
   * Logomark glyph drawn on the accent tile: an inline <svg viewBox="0 0 24 24"> using currentColor.
   * Defaults to the title's initial. Configs that must stay JSX-free can use `logoPaths` instead.
   */
  logo?: ReactNode;
  /** SVG path data on a 24×24 viewBox, stroked with currentColor at 2px (an alternative to `logo`). */
  logoPaths?: string[];
}

export interface AppContextValue<S> {
  config: AppConfig<S & { Person: Person; AppMarker: AppMarker }>;
  mode: AppMode;
  store: DataStore<S>;
  viewer: Viewer;
  me: Person;
  isAdmin: boolean;
  /** The Rayfin client in Fabric mode (for connectors); null in demo mode. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any | null;
  refreshMe(): Promise<void>;
  /** Demo mode only: switch the fictional viewer. */
  switchPersona?(sub: string): void;
  /** Demo mode only: wipe local data and re-seed. */
  resetDemo?(): void;
  signOut?(): Promise<void>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const AppCtx = createContext<AppContextValue<any> | null>(null);

export function useApp<S>(): AppContextValue<S> {
  const v = useContext(AppCtx);
  if (!v) throw new Error('useApp must be used inside mountApp().');
  return v as AppContextValue<S>;
}
