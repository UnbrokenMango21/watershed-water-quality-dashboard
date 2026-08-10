import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { SiteCatalogEntry, Submission } from '@/domain/types';
import {
  listenRecentSubmissions,
  listenSiteCatalog,
  loadCachedSiteCatalog,
  refreshSiteCatalog,
} from '@/services/firestore';

export type DataSourceState = 'loading' | 'server' | 'cached' | 'empty' | 'error';

type CatalogState = {
  sites: SiteCatalogEntry[];
  source: DataSourceState;
  refreshing: boolean;
  invalidDocumentCount: number;
  error: string | null;
};

type RecentState = {
  submissions: Submission[];
  source: DataSourceState;
  invalidDocumentCount: number;
  error: string | null;
};

type CollectorDataContextValue = {
  catalog: CatalogState;
  recent: RecentState;
  refreshSites: () => Promise<void>;
};

const initialCatalog: CatalogState = {
  sites: [],
  source: 'loading',
  refreshing: false,
  invalidDocumentCount: 0,
  error: null,
};

const initialRecent: RecentState = {
  submissions: [],
  source: 'loading',
  invalidDocumentCount: 0,
  error: null,
};

const CollectorDataContext = createContext<CollectorDataContextValue | undefined>(undefined);

function invalidRecordMessage(kind: 'site' | 'submission', count: number): string | null {
  if (count <= 0) return null;
  const noun = kind === 'site' ? 'site record' : 'submission record';
  return `${count} ${noun}${count === 1 ? '' : 's'} could not be read and ${count === 1 ? 'was' : 'were'} excluded.`;
}

export function CollectorDataProvider({ uid, children }: PropsWithChildren<{ uid: string }>) {
  const [catalog, setCatalog] = useState<CatalogState>(initialCatalog);
  const [recent, setRecent] = useState<RecentState>(initialRecent);

  useEffect(() => {
    let active = true;

    void loadCachedSiteCatalog()
      .then((snapshot) => {
        if (!active || snapshot.data.length === 0) return;
        setCatalog({
          sites: snapshot.data,
          source: 'cached',
          refreshing: false,
          invalidDocumentCount: snapshot.invalidDocumentCount,
          error: invalidRecordMessage('site', snapshot.invalidDocumentCount),
        });
      })
      .catch(() => {
        // The live listener below remains the source of truth.
      });

    const stopSites = listenSiteCatalog(
      (snapshot) => {
        if (!active) return;
        setCatalog((current) => {
          if (snapshot.metadata.fromCache && snapshot.data.length === 0 && current.sites.length > 0) {
            return {
              ...current,
              source: 'cached',
              refreshing: false,
              invalidDocumentCount: snapshot.invalidDocumentCount,
              error: invalidRecordMessage('site', snapshot.invalidDocumentCount),
            };
          }
          return {
            sites: snapshot.data,
            source: snapshot.metadata.fromCache
              ? snapshot.data.length > 0
                ? 'cached'
                : 'loading'
              : snapshot.data.length > 0
                ? 'server'
                : 'empty',
            refreshing: false,
            invalidDocumentCount: snapshot.invalidDocumentCount,
            error: invalidRecordMessage('site', snapshot.invalidDocumentCount),
          };
        });
      },
      () => {
        if (!active) return;
        setCatalog((current) => ({
          ...current,
          source: current.sites.length > 0 ? 'cached' : 'error',
          refreshing: false,
          error: 'Could not load the site catalog.',
        }));
      },
    );

    const stopRecent = listenRecentSubmissions(
      uid,
      (snapshot) => {
        if (!active) return;
        setRecent({
          submissions: snapshot.data,
          source: snapshot.metadata.fromCache
            ? 'cached'
            : snapshot.data.length > 0
              ? 'server'
              : 'empty',
          invalidDocumentCount: snapshot.invalidDocumentCount,
          error: invalidRecordMessage('submission', snapshot.invalidDocumentCount),
        });
      },
      () => {
        if (!active) return;
        setRecent((current) => ({
          ...current,
          source: current.submissions.length > 0 ? 'cached' : 'error',
          error: 'Could not load recent submissions.',
        }));
      },
    );

    return () => {
      active = false;
      stopSites();
      stopRecent();
    };
  }, [uid]);

  const refreshSites = useCallback(async () => {
    setCatalog((current) => ({ ...current, refreshing: true, error: null }));
    try {
      const snapshot = await refreshSiteCatalog();
      setCatalog({
        sites: snapshot.data,
        source: snapshot.data.length > 0 ? 'server' : 'empty',
        refreshing: false,
        invalidDocumentCount: snapshot.invalidDocumentCount,
        error: invalidRecordMessage('site', snapshot.invalidDocumentCount),
      });
    } catch {
      setCatalog((current) => ({
        ...current,
        source: current.sites.length > 0 ? 'cached' : 'error',
        refreshing: false,
        error: current.sites.length > 0
          ? 'Refresh failed. Saved sites remain available.'
          : 'Could not refresh the site catalog.',
      }));
    }
  }, []);

  const value = useMemo<CollectorDataContextValue>(
    () => ({ catalog, recent, refreshSites }),
    [catalog, recent, refreshSites],
  );

  return <CollectorDataContext.Provider value={value}>{children}</CollectorDataContext.Provider>;
}

export function useCollectorData() {
  const context = useContext(CollectorDataContext);
  if (!context) throw new Error('useCollectorData must be used within CollectorDataProvider');
  return context;
}
