'use client';

/** Persistent bounded queue/history pages. Scope changes invalidate outstanding reads. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { fetchQueue } from '@/lib/data';
import { mergeQueueRows } from '@/lib/queueFilters.mjs';
import type { HistoryQueueRow, QueueScope } from '@/lib/queue-types';

export interface QueueState {
  rows: HistoryQueueRow[] | null;
  error: string | null;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  now: number | null;
  scope: QueueScope;
  setScope: (scope: QueueScope) => void;
  reload: () => Promise<void>;
  loadMore: () => Promise<void>;
}
const QueueContext = createContext<QueueState | null>(null);
export function useQueue(): QueueState {
  const state = useContext(QueueContext);
  if (!state) throw new Error('useQueue must be used inside a QueueProvider.');
  return state;
}
export default function QueueProvider({ children }: { children: ReactNode }) {
  const [rows, setRows] = useState<HistoryQueueRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const [scope, updateScope] = useState<QueueScope>({ mode: 'review', siteId: '', collectorUid: '', status: '' });
  const cursor = useRef<QueryDocumentSnapshot | null>(null);
  const sequence = useRef(0);
  const moreInFlight = useRef(false);
  const setScope = useCallback((next: QueueScope) => {
    if (scope.mode === next.mode && scope.siteId === next.siteId && scope.collectorUid === next.collectorUid && scope.status === next.status) return;
    // Invalidate immediately, before the effect runs; a late page can never restore the prior scope.
    sequence.current += 1;
    setRows(null); setHasMore(false); cursor.current = null;
    updateScope(next);
  }, [scope]);
  const reload = useCallback(async () => {
    const current = ++sequence.current;
    moreInFlight.current = false;
    setLoading(true); setLoadingMore(false); setError(null);
    try {
      const result = await fetchQueue(scope);
      if (current !== sequence.current) return;
      setRows(result.rows); cursor.current = result.cursor; setHasMore(result.hasMore); setNow(Date.now());
    } catch {
      if (current === sequence.current) setError('Submissions could not be loaded. Refresh or try again in a moment.');
    } finally { if (current === sequence.current) setLoading(false); }
  }, [scope]);
  const loadMore = useCallback(async () => {
    if (loading || moreInFlight.current || !hasMore || !cursor.current) return;
    const current = sequence.current;
    moreInFlight.current = true; setLoadingMore(true); setError(null);
    try {
      const result = await fetchQueue({ ...scope, cursor: cursor.current });
      if (current !== sequence.current) return;
      setRows(previous => mergeQueueRows(previous ?? [], result.rows));
      cursor.current = result.cursor; setHasMore(result.hasMore); setNow(Date.now());
    } catch {
      if (current === sequence.current) setError('The next page could not be loaded. Existing rows are retained; try Load more again.');
    } finally {
      if (current === sequence.current) { moreInFlight.current = false; setLoadingMore(false); }
    }
  }, [scope, loading, hasMore]);
  useEffect(() => { void reload(); return () => { sequence.current += 1; }; }, [reload]);
  const value = useMemo<QueueState>(() => ({ rows, error, loading, loadingMore, hasMore, now, scope, setScope, reload, loadMore }),
    [rows, error, loading, loadingMore, hasMore, now, scope, setScope, reload, loadMore]);
  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
}
