import { useCallback, useEffect, useRef, useState } from 'react';

import { describeError, type AppErrorInfo } from './errors';

export interface AsyncState<T> {
  data: T | undefined;
  loading: boolean;
  error: AppErrorInfo | null;
  /** Re-run the loader. Resolves when done. */
  reload: () => Promise<void>;
}

/**
 * Run an async loader on mount and whenever `deps` change. Keeps the previous data while reloading so polling
 * does not flash the loading state.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AppErrorInfo | null>(null);
  const seq = useRef(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true);
    try {
      const result = await loaderRef.current();
      if (mine === seq.current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (mine === seq.current) setError(describeError(err));
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading: loading && data === undefined, error, reload: run };
}

/** Call `fn` every `ms` while the page is visible. */
export function usePolling(fn: () => void | Promise<void>, ms: number, enabled = true) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!enabled) return;
    let busy = false;
    const tick = async () => {
      if (busy || document.visibilityState === 'hidden') return;
      busy = true;
      try {
        await ref.current();
      } finally {
        busy = false;
      }
    };
    const id = window.setInterval(tick, ms);
    const onVisible = () => document.visibilityState === 'visible' && void tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [ms, enabled]);
}

/** Run an async action with pending and error state, for buttons and forms. */
export function useAction<A extends unknown[], R>(action: (...args: A) => Promise<R>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<AppErrorInfo | null>(null);
  const run = useCallback(
    async (...args: A): Promise<R | undefined> => {
      setPending(true);
      setError(null);
      try {
        return await action(...args);
      } catch (err) {
        setError(describeError(err));
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [action],
  );
  return { run, pending, error, clearError: () => setError(null) };
}

/** Current time that re-renders every `ms` (for countdowns and "x min ago"). */
export function useNow(ms = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}
