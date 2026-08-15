'use client';

/**
 * Queue state for the whole workspace.
 *
 * The queue lives in the /review layout rather than in a page, so it survives
 * navigation between records: selecting a submission does not refetch or
 * re-scroll the rail. `reload` is exposed so a recorded decision can refresh
 * the rail immediately without a full page reload.
 *
 * This wraps the existing `fetchQueue` read unchanged — same Firestore query,
 * same ordering.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { fetchQueue } from '@/lib/data';
import type { QueueRow } from '@/lib/types';

export interface QueueState {
  rows: QueueRow[] | null;
  error: string | null;
  loading: boolean;
  /** One clock for every row's age, captured at load time. */
  now: number | null;
  reload: () => Promise<void>;
}

const QueueContext = createContext<QueueState | null>(null);

export function useQueue(): QueueState {
  const state = useContext(QueueContext);
  if (!state) throw new Error('useQueue must be used inside a QueueProvider.');
  return state;
}

export default function QueueProvider({ children }: { children: ReactNode }) {
  const [rows, setRows] = useState<QueueRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState<number | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchQueue();
      setRows(result);
      setNow(Date.now());
    } catch {
      setError('The review queue could not be loaded. Refresh the page or try again in a moment.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo<QueueState>(
    () => ({ rows, error, loading, now, reload }),
    [rows, error, loading, now, reload],
  );

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
}
