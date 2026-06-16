import { useCallback, useEffect, useRef, useState } from 'react';
import { addTorrentMagnet, addWebDownload, controlDownload, fetchDownloads } from '../api/torbox';
import { getCachedDownloads, saveDownloadsCache } from '../cache/downloadsCache';
import type { CloudDownload, CloudDownloadType } from '../types/downloads';

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

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

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
    void load();
  }, [load]);

  const addDownload = useCallback(
    async (_name: string, type: CloudDownloadType, url: string) => {
      if (!apiKey) {
        return;
      }

      if (type === 'torrent') {
        await addTorrentMagnet(apiKey, url);
      } else {
        await addWebDownload(apiKey, url);
      }
      // Refresh the list to show the new download
      await load();
    },
    [apiKey, load]
  );

  const pauseDownload = useCallback(
    (id: string) => {
      const download = downloads.find((d) => d.id === id);
      if (!download || !apiKey || download.type !== 'torrent') {
        return;
      }
      void controlDownload(apiKey, id, 'torrent', 'pause').then(() => load());
    },
    [apiKey, downloads, load]
  );

  const resumeDownload = useCallback(
    (id: string) => {
      const download = downloads.find((d) => d.id === id);
      if (!download || !apiKey || download.type !== 'torrent') {
        return;
      }
      void controlDownload(apiKey, id, 'torrent', 'resume').then(() => load());
    },
    [apiKey, downloads, load]
  );

  const removeDownload = useCallback(
    (id: string) => {
      const download = downloads.find((d) => d.id === id);
      if (!download || !apiKey) {
        return;
      }
      void controlDownload(apiKey, id, download.type, 'delete').then(() => load());
    },
    [apiKey, downloads, load]
  );

  const retryDownload = useCallback(
    (id: string) => {
      // Retry: resume if paused, or just refresh if errored
      const download = downloads.find((d) => d.id === id);
      if (!download || !apiKey) {
        return;
      }
      if (download.type === 'torrent') {
        void controlDownload(apiKey, id, 'torrent', 'resume').then(() => load());
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
