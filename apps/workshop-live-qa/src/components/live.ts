/** Live-screen hooks: poll a board every few seconds and keep the visible order stable while reading. */
import { useEffect, useState } from 'react';

import { useApp } from '@x10/shared/runtime';
import { useAsync, usePolling } from '@x10/shared/lib';

import { rules } from '../config';
import { loadBoard } from '../domain/sessions';
import { stabiliseOrder } from '../domain/rules';
import type { Schema } from '../model';

/** Load a session board by code and refetch it every 5 s while the tab is visible. */
export function useBoard(code: string) {
  const { store, me } = useApp<Schema>();
  const board = useAsync(() => loadBoard(store, me, code), [store, me.sub, code]);
  usePolling(board.reload, rules.pollMs);
  return board;
}

/**
 * The on-screen order of a live list. New ids are held back as `pending` (shown by the pill) and existing rows keep
 * their place even when scores change; `showAll()` applies the fresh order (after the reader's own post, or the pill).
 */
export function useStableOrder(sortedIds: string[] | undefined) {
  const [shown, setShown] = useState<string[] | null>(null);
  const key = sortedIds?.join('|') ?? '';
  const isReset = shown === null;
  useEffect(() => {
    if (!sortedIds) return;
    setShown((prev) => {
      if (prev === null) return sortedIds;
      const fresh = new Set(sortedIds);
      return prev.every((id) => fresh.has(id)) ? prev : prev.filter((id) => fresh.has(id));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, isReset]);
  const { order, pending } = stabiliseOrder(shown, sortedIds ?? []);
  const stale = pending.length === 0 && order.join('|') !== key;
  return { order, pending, stale, showAll: () => setShown(null) };
}
