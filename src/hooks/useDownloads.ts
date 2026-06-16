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

  // Derive whether there are active downloads from state (used outside render to
  // avoid stale-closure issues — we recompute inside the poll callback).
  const hasActiveDownloads = useCallback(
    (list: CloudDownload[]) =>
      list.some((d) => d.status === 'downloading' || d.status === 'queued'),
    []
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
      fetchDownloads(apiKey)
        .then((data) => {
          if (!mountedRef.current) {
            return;
          }
          setDownloads(data);
          setError(null);
          saveDownloadsCache(data).catch(() => {});
          // Stop polling if nothing is active anymore
          if (!hasActiveDownloads(data)) {
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
  }, [apiKey, hasActiveDownloads, clearPolling]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      clearPolling();
    };
  }, [clearPolling]);

  const load = useCallback(async () => {
    if (!apiKey) {
      setDownloads([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    // 1. Show cached data immediately for instant display
    try {
      const cached = await getCachedDownloads();
      if (mountedRef.current && cached.length > 0) {
        setDownloads(cached);
      }
    } catch {
      // Cache read failure is non-fatal — proceed to API fetch
    }

    // 2. Fetch fresh data from API in the background
    try {
      const data = await fetchDownloads(apiKey);
      if (mountedRef.current) {
        setDownloads(data);
      }
      // Persist to cache (don't block the UI on this)
      saveDownloadsCache(data).catch(() => {
        // Cache write failure is non-fatal
      });
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [apiKey]);

  // Initial load and reload when apiKey changes
  useEffect(() => {
    clearPolling();
    void load();
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
    await load();
  }, [load]);

  const byType = useCallback(
    (type: CloudDownloadType) => downloads.filter((d) => d.type === type),
    [downloads]
  );

  const counts = {
    total: downloads.length,
    active: downloads.filter((d) => d.status === 'downloading' || d.status === 'queued').length,
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
