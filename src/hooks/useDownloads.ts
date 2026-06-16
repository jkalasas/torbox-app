import { useCallback, useEffect, useState } from 'react';
import type { CloudDownload, CloudDownloadStatus, CloudDownloadType } from '../types/downloads';

/** Simulated API delay */
const SIMULATED_DELAY_MS = 400;

const MOCK_DOWNLOADS: CloudDownload[] = [
  {
    id: 'dl-1',
    name: 'ubuntu-24.04.1-desktop-amd64.iso',
    type: 'torrent',
    status: 'downloading',
    progress: 67,
    sizeBytes: 5_700_000_000,
    speedBytesPerSec: 8_400_000,
    etaSeconds: 224,
    seeders: 142,
    peers: 38,
    addedAt: new Date('2026-06-15T14:30:00Z'),
    fileCount: 1,
    paused: false,
  },
  {
    id: 'dl-2',
    name: 'debian-12.5.0-amd64-netinst.iso',
    type: 'torrent',
    status: 'cached',
    progress: 100,
    sizeBytes: 3_800_000_000,
    addedAt: new Date('2026-06-14T09:15:00Z'),
    fileCount: 3,
    paused: false,
  },
  {
    id: 'dl-3',
    name: 'archlinux-2026.06.01-x86_64.iso',
    type: 'torrent',
    status: 'error',
    progress: 42,
    sizeBytes: 1_200_000_000,
    speedBytesPerSec: 2_100_000,
    etaSeconds: 331,
    errorMessage: 'Tracker connection timed out',
    seeders: 12,
    peers: 5,
    addedAt: new Date('2026-06-16T08:00:00Z'),
    fileCount: 1,
    paused: false,
  },
  {
    id: 'dl-4',
    name: 'fedora-40-workstation-live-x86_64.iso',
    type: 'torrent',
    status: 'queued',
    progress: 0,
    sizeBytes: 2_100_000_000,
    seeders: 89,
    peers: 0,
    addedAt: new Date('2026-06-16T10:45:00Z'),
    fileCount: 1,
    paused: false,
  },
  {
    id: 'dl-5',
    name: 'pop-os_24.04_amd64_nvidia.iso',
    type: 'torrent',
    status: 'cached',
    progress: 100,
    sizeBytes: 2_800_000_000,
    addedAt: new Date('2026-06-13T22:10:00Z'),
    fileCount: 1,
    paused: false,
  },
  {
    id: 'dl-6',
    name: 'project-files-2026.zip',
    type: 'web',
    status: 'downloading',
    progress: 31,
    sizeBytes: 850_000_000,
    speedBytesPerSec: 12_500_000,
    etaSeconds: 47,
    addedAt: new Date('2026-06-16T11:20:00Z'),
    fileCount: 5,
    paused: false,
  },
  {
    id: 'dl-7',
    name: 'dataset-backup.tar.gz',
    type: 'web',
    status: 'queued',
    progress: 0,
    sizeBytes: 15_000_000_000,
    addedAt: new Date('2026-06-16T11:25:00Z'),
    fileCount: 1,
    paused: false,
  },
  {
    id: 'dl-8',
    name: 'presentation-slides.pdf',
    type: 'web',
    status: 'error',
    progress: 0,
    sizeBytes: 45_000_000,
    errorMessage: 'URL returned 404',
    addedAt: new Date('2026-06-16T10:50:00Z'),
    fileCount: 1,
    paused: false,
  },
];

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

function simulateApiCall<T>(data: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), SIMULATED_DELAY_MS));
}

export function useDownloads(): UseDownloadsReturn {
  const [downloads, setDownloads] = useState<CloudDownload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await simulateApiCall(MOCK_DOWNLOADS);
      setDownloads(data);
    } catch {
      setError('Failed to load downloads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addDownload = useCallback(async (name: string, type: CloudDownloadType) => {
    const newDownload: CloudDownload = {
      id: `dl-${Date.now()}`,
      name,
      type,
      status: 'queued',
      progress: 0,
      sizeBytes: 0,
      addedAt: new Date(),
      fileCount: 1,
      paused: false,
    };
    setDownloads((prev) => [newDownload, ...prev]);
  }, []);

  const updateStatus = useCallback(
    (id: string, status: CloudDownloadStatus, paused = false, extra?: Partial<CloudDownload>) => {
      setDownloads((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status, paused, ...extra } : d))
      );
    },
    []
  );

  const pauseDownload = useCallback(
    (id: string) => updateStatus(id, 'downloading', true),
    [updateStatus]
  );
  const resumeDownload = useCallback(
    (id: string) => updateStatus(id, 'downloading', false),
    [updateStatus]
  );
  const retryDownload = useCallback(
    (id: string) =>
      updateStatus(id, 'downloading', false, { progress: 0, errorMessage: undefined }),
    [updateStatus]
  );
  const removeDownload = useCallback((id: string) => {
    setDownloads((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const refresh = useCallback(async () => {
    await simulateApiCall(null);
    // In a real app, refetch from API. For mock, just keep data.
  }, []);

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
