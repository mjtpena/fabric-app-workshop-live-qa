import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';

import { createMemoryStore } from '../data/memoryStore';
import { createRayfinStore } from '../data/rayfinStore';
import type { DataStore } from '../data/types';
import { ensurePerson, type AppMarker, type Person, type Viewer } from '../identity';
import { describeError, type AppErrorInfo } from '../lib/errors';
import { AppCtx, type AppConfig, type AppContextValue, type AppMode } from './context';
import { BootScreen, SignInPage, StartError } from './shell';
import { applyAccent, applyTheme, getThemePref, resolveAccent } from './theme';
import { createFabricSession, type FabricSession } from './fabric';
import { runSeed } from './seed';

export { runSeed, SEED_MARKER, type SeedContext, type SeedFn } from './seed';
export type { FabricClientOptions } from './fabric';

export { useApp, type AppConfig, type AppContextValue, type AppMode, type NavItem } from './context';
export { AppShell, Footer, AdminOnly, AppLogo, SignInPage, BootScreen } from './shell';
export { DEFAULT_ACCENTS, resolveAccent, useThemePref, setThemePref, getThemePref, type ThemePref } from './theme';

/** Decide the runtime mode. `VITE_X10_MODE` wins; otherwise a remote Rayfin API URL means Fabric. */
export function detectMode(): AppMode {
  const forced = import.meta.env.VITE_X10_MODE as string | undefined;
  if (forced === 'demo' || forced === 'fabric') return forced;
  const api = import.meta.env.VITE_RAYFIN_API_URL as string | undefined;
  if (!api || /^https?:\/\/(localhost|127\.0\.0\.1)([:/]|$)/.test(api)) return 'demo';
  return 'fabric';
}

function queryParam(name: string): string | null {
  const fromSearch = new URLSearchParams(window.location.search).get(name);
  if (fromSearch) return fromSearch;
  const hashQuery = window.location.hash.split('?')[1];
  return hashQuery ? new URLSearchParams(hashQuery).get(name) : null;
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

type Phase =
  | { kind: 'booting' }
  | { kind: 'signin'; session: FabricSession; error: string | null }
  | { kind: 'error'; error: AppErrorInfo }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { kind: 'ready'; value: AppContextValue<any> };

function Root<S extends { Person: Person; AppMarker: AppMarker }>({
  config,
  children,
}: {
  config: AppConfig<S>;
  children: ReactNode;
}) {
  const mode = useMemo(detectMode, []);
  const [phase, setPhase] = useState<Phase>({ kind: 'booting' });
  const [attempt, setAttempt] = useState(0);
  const storageKey = `x10:${config.appId}:data:v1`;
  const personaKey = `x10:${config.appId}:persona`;

  const finish = useCallback(
    async (
      store: DataStore<S>,
      viewer: Viewer,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      extras: Partial<AppContextValue<S>> & { client: any | null },
    ) => {
      const peopleStore = store as unknown as DataStore<{ Person: Person }>;
      let me = await ensurePerson(peopleStore, viewer);
      const build = (person: Person): AppContextValue<S> => ({
        config: config as AppContextValue<S>['config'],
        mode,
        store,
        viewer,
        me: person,
        isAdmin: person.isAdmin === true,
        refreshMe: async () => {
          const fresh = await peopleStore.repo('Person').get(me.id);
          if (fresh) {
            me = fresh;
            setPhase({ kind: 'ready', value: build(fresh) });
          }
        },
        ...extras,
      });
      setPhase({ kind: 'ready', value: build(me) });
    },
    [config, mode],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (mode === 'demo') {
          const latency = Number(import.meta.env.VITE_X10_LATENCY ?? 120);
          const store = createMemoryStore<S>(config.defs, { storageKey, latencyMs: Number.isFinite(latency) ? latency : 0 });
          // Seeding writes many rows; do it without artificial latency.
          const fast = createMemoryStore<S>(config.defs, { storageKey });
          await runSeed(fast, config.personas, config.seed);
          const requested = queryParam('as');
          const sub =
            config.personas.find((p) => p.sub === requested)?.sub ??
            config.personas.find((p) => p.sub === safeGet(personaKey))?.sub ??
            config.personas[0].sub;
          safeSet(personaKey, sub);
          const persona = config.personas.find((p) => p.sub === sub)!;
          if (cancelled) return;
          await finish(store, persona, {
            client: null,
            switchPersona: (next) => {
              safeSet(personaKey, next);
              window.location.reload();
            },
            resetDemo: () => {
              try {
                localStorage.removeItem(storageKey);
              } catch {
                /* ignore */
              }
              window.location.reload();
            },
          });
          return;
        }
        const session = await createFabricSession(config.fabric);
        const viewer = await session.restore();
        if (cancelled) return;
        if (!viewer) {
          setPhase({ kind: 'signin', session, error: null });
          return;
        }
        const store = config.fabric?.data === false
          ? createMemoryStore<S>(config.defs)
          : createRayfinStore<S>(session.client, config.defs);
        await finish(store, viewer, {
          client: session.client,
          signOut: async () => {
            await session.signOut();
            window.location.reload();
          },
        });
      } catch (err) {
        if (!cancelled) setPhase({ kind: 'error', error: describeError(err) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt, config, finish, mode, personaKey, storageKey]);

  if (phase.kind === 'booting') return <BootScreen config={config} />;
  if (phase.kind === 'error') return <StartError config={config} error={phase.error} onRetry={() => setAttempt((n) => n + 1)} />;
  if (phase.kind === 'signin') {
    return (
      <SignInPage
        title={config.title}
        tagline={config.tagline}
        logo={config.logo}
        logoPaths={config.logoPaths}
        error={phase.error}
        onSignIn={async () => {
          try {
            const viewer = await phase.session.signIn();
            const store = config.fabric?.data === false
              ? createMemoryStore<S>(config.defs)
              : createRayfinStore<S>(phase.session.client, config.defs);
            await finish(store, viewer, {
              client: phase.session.client,
              signOut: async () => {
                await phase.session.signOut();
                window.location.reload();
              },
            });
          } catch (err) {
            // Always surface sign-in errors (ACCESS_DENIED, closed popup, …).
            setPhase({ kind: 'signin', session: phase.session, error: describeError(err).message });
          }
        }}
      />
    );
  }
  return <AppCtx.Provider value={phase.value}>{children}</AppCtx.Provider>;
}

/** Mount the app: boot (demo or Fabric), then render `children` (usually <Routes>) inside a HashRouter. */
export function mountApp<S extends { Person: Person; AppMarker: AppMarker }>(config: AppConfig<S>, children: ReactNode) {
  const el = document.getElementById('root');
  if (!el) throw new Error('No #root element.');
  applyAccent(resolveAccent(config.appId, config.accent));
  applyTheme(getThemePref());
  createRoot(el).render(
    <HashRouter>
      <Root config={config}>{children}</Root>
    </HashRouter>,
  );
}
