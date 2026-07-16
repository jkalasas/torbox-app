import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TorBoxApiError,
  addTorrentMagnet,
  addWebDownload,
  controlDownload,
  fetchDownloads,
} from '../api/torbox';
import { getCachedDownloads, saveDownloadsCache } from '../cache/downloadsCache';
import type { CloudDownload, CloudDownloadType } from '../types/downloads';

interface LoadOptions {
  /** When true, the load is a silent background refresh and should not show
   *  the loading skeleton or clear the existing error banner. */
  background?: boolean;
}

/** Poll interval in ms when there are active (downloading/queued) downloads. */
const POLL_INTERVAL_MS = 5000;

export interface UseDownloadsReturn {
  downloads: CloudDownload[];
  loading: boolean;
  error: string | null;
  addDownload: (name: string, type: CloudDownloadType, url: string) => Promise<void>;
  pauseDownload: (id: string) => void;
  resumeDownload: (id: string) => void;
  removeDownload: (id: string) => void;
  retryDownload: (id: string) => void;
  refresh: () => Promise<void>;
  /** Filter by type (torrent or web) */
  byType: (type: CloudDownloadType) => CloudDownload[];
  /** Aggregate counts */
  counts: {
    total: number;
    active: number;
    error: number;
    torrents: number;
    web: number;
  };
}

export function useDownloads(apiKey: string): UseDownloadsReturn {
  const [downloads, setDownloads] = useState<CloudDownload[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPollingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const loadPromiseRef = useRef<Promise<void> | null>(null);
  const loadApiKeyRef = useRef<string | null>(null);
  const downloadsRef = useRef<CloudDownload[]>([]);

  // Derive whether there are active downloads from state (used outside render to
  // avoid stale-closure issues — we recompute inside the poll callback).
  const hasActiveDownloads = useCallback(
    (list: CloudDownload[]) =>
      list.some((d) => d.status === 'downloading' || d.status === 'queued'),
    []
  );

  // -----------------------------------------------------------------------
  // Loading
  // -----------------------------------------------------------------------
  const load = useCallback(
    async (options: LoadOptions = {}) => {
      if (!apiKey) {
        setDownloads([]);
        setLoading(false);
        setError(null);
        return;
      }

      // Deduplicate: if a load is already running for the same API key, return
      // the same promise. A different key means the old request is stale.
      if (loadPromiseRef.current !== null && loadApiKeyRef.current === apiKey) {
        return loadPromiseRef.current;
      }

      // Cancel any previous in-flight request so stale data doesn't overwrite
      // a newer response.
      if (abortControllerRef.current !== null) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      loadApiKeyRef.current = apiKey;

      const { background = false } = options;

      if (!background) {
        setLoading(true);
        setError(null);
      }

      const run = async () => {
        // 1. Show cached data immediately for instant display
        try {
          const cached = await getCachedDownloads();
          if (mountedRef.current && cached.length > 0) {
            setDownloads(cached);
          }
        } catch {
          // Cache read failure is non-fatal — proceed to API fetch
        }

        // 2. Fetch fresh data from API
        try {
          const data = await fetchDownloads(apiKey, abortController.signal);
          if (mountedRef.current && !abortController.signal.aborted) {
            setDownloads(data);
            if (!background) {
              setError(null);
            }
          }
          // Persist to cache (don't block the UI on this)
          saveDownloadsCache(data).catch(() => {
            // Cache write failure is non-fatal
          });
        } catch (err) {
          if (mountedRef.current && !abortController.signal.aborted && !background) {
            setError(err instanceof Error ? err.message : String(err));
          }
        } finally {
          if (mountedRef.current && !background) {
            setLoading(false);
          }
        }
      };

      loadPromiseRef.current = run();
      try {
        await loadPromiseRef.current;
      } finally {
        loadPromiseRef.current = null;
        loadApiKeyRef.current = null;
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
      }
    },
    [apiKey]
  );

  // -----------------------------------------------------------------------
  // Polling: efficient background refresh only when something is active
  // -----------------------------------------------------------------------
  const clearPolling = useCallback(() => {
    if (pollTimerRef.current !== null) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollTimerRef.current !== null) {
      return;
    } // already polling
    pollTimerRef.current = setInterval(() => {
      if (!mountedRef.current || !apiKey) {
        return;
      }
      // Don't stack polls — skip if a previous poll is still running
      if (isPollingRef.current) {
        return;
      }
      isPollingRef.current = true;
      // Background refresh reuses the same cache + fetch path without flashing
      // the loading skeleton.
      load({ background: true })
        .then(() => {
          if (!mountedRef.current) {
            return;
          }
          // Stop polling if nothing is active anymore
          if (!hasActiveDownloads(downloadsRef.current)) {
            clearPolling();
          }
        })
        .catch(() => {
          // Poll failures are silent — don't overwrite a previous error
          // or show transient errors from background refreshes
        })
        .finally(() => {
          isPollingRef.current = false;
        });
    }, POLL_INTERVAL_MS);
  }, [apiKey, hasActiveDownloads, clearPolling, load]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      clearPolling();
    };
  }, [clearPolling]);

  // Initial load and reload when apiKey changes
  useEffect(() => {
    clearPolling();
    void load();

    return () => {
      if (abortControllerRef.current !== null) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [load, clearPolling]);

  const addDownload = useCallback(
    async (_name: string, type: CloudDownloadType, url: string) => {
      if (!apiKey) {
        return;
      }

      try {
        if (type === 'torrent') {
          await addTorrentMagnet(apiKey, url);
        } else {
          await addWebDownload(apiKey, url);
        }
        // Refresh the list to show the new download
        await load();
      } catch (err) {
        if (!mountedRef.current) {
          return;
        }
        setError(
          err instanceof TorBoxApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : String(err)
        );
        // Still refresh in case the add succeeded despite the error response
        load().catch(() => {});
      }
    },
    [apiKey, load]
  );

  // Shared handler for torrent control operations (pause / resume / delete)
  const handleControlOperation = useCallback(
    (id: string, op: 'pause' | 'resume' | 'delete') => {
      const download = downloads.find((d) => d.id === id);
      if (!download || !apiKey) {
        return;
      }
      if (op !== 'delete' && download.type !== 'torrent') {
        return;
      }
      controlDownload(apiKey, id, download.type, op)
        .then(() => load())
        .catch((err) => {
          if (!mountedRef.current) {
            return;
          }
          setError(
            err instanceof TorBoxApiError
              ? err.message
              : err instanceof Error
                ? err.message
                : String(err)
          );
          // Optimistic: refresh the list anyway — the operation may have
          // succeeded server-side despite the error response.
          load().catch(() => {});
        });
    },
    [apiKey, downloads, load]
  );

  const pauseDownload = useCallback(
    (id: string) => handleControlOperation(id, 'pause'),
    [handleControlOperation]
  );

  const resumeDownload = useCallback(
    (id: string) => handleControlOperation(id, 'resume'),
    [handleControlOperation]
  );

  const removeDownload = useCallback(
    (id: string) => handleControlOperation(id, 'delete'),
    [handleControlOperation]
  );

  const retryDownload = useCallback(
    (id: string) => {
      const download = downloads.find((d) => d.id === id);
      if (!download || !apiKey) {
        return;
      }
      if (download.type === 'torrent') {
        controlDownload(apiKey, id, 'torrent', 'resume')
          .then(() => load())
          .catch((err) => {
            if (!mountedRef.current) {
              return;
            }
            setError(
              err instanceof TorBoxApiError
                ? err.message
                : err instanceof Error
                  ? err.message
                  : String(err)
            );
            load().catch(() => {});
          });
      } else {
        // Web downloads only support delete — just refresh
        void load();
      }
    },
    [apiKey, downloads, load]
  );

  const refresh = useCallback(async () => {
    await load({ background: false });
  }, [load]);

  const byType = useCallback(
    (type: CloudDownloadType) => downloads.filter((d) => d.type === type),
    [downloads]
  );

  const counts = {
    total: downloads.length,
    // Match Active filter / SideNav: only in-progress downloads, not queued.
    active: downloads.filter((d) => d.status === 'downloading').length,
    error: downloads.filter((d) => d.status === 'error').length,
    torrents: downloads.filter((d) => d.type === 'torrent').length,
    web: downloads.filter((d) => d.type === 'web').length,
  };

  // Start / stop polling based on active downloads
  useEffect(() => {
    if (!apiKey || !mountedRef.current) {
      return;
    }
    if (hasActiveDownloads(downloads) && !loading) {
      startPolling();
    } else {
      clearPolling();
    }
  }, [downloads, apiKey, loading, startPolling, clearPolling, hasActiveDownloads]);

  // Keep a stable ref to the latest downloads for the polling callback so it
  // can decide whether to stop without adding downloads to startPolling deps.
  useEffect(() => {
    downloadsRef.current = downloads;
  }, [downloads]);

  return {
    downloads,
    loading,
    error,
    addDownload,
    pauseDownload,
    resumeDownload,
    removeDownload,
    retryDownload,
    refresh,
    byType,
    counts,
  };
}
