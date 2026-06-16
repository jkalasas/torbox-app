import { useCallback, useEffect, useState } from 'react';
import type { LocalTransfer } from '../types/downloads';

const SIMULATED_DELAY_MS = 400;

const MOCK_TRANSFERS: LocalTransfer[] = [
  {
    id: 'local-1',
    name: 'debian-12.5.0-amd64-netinst.iso',
    status: 'transferring',
    progress: 58,
    sizeBytes: 3_800_000_000,
    speedBytesPerSec: 15_200_000,
    etaSeconds: 105,
    destinationPath: '~/Downloads',
    cloudDownloadId: 'dl-2',
    addedAt: new Date('2026-06-16T11:00:00Z'),
  },
  {
    id: 'local-2',
    name: 'pop-os_24.04_amd64_nvidia.iso',
    status: 'complete',
    progress: 100,
    sizeBytes: 2_800_000_000,
    destinationPath: '~/Downloads/ISOs',
    cloudDownloadId: 'dl-5',
    addedAt: new Date('2026-06-15T09:30:00Z'),
  },
  {
    id: 'local-3',
    name: 'ubuntu-24.04.1-desktop-amd64.iso',
    status: 'error',
    progress: 12,
    sizeBytes: 5_700_000_000,
    speedBytesPerSec: 0,
    errorMessage: 'Insufficient disk space',
    destinationPath: '~/Downloads',
    cloudDownloadId: 'dl-1',
    addedAt: new Date('2026-06-16T11:05:00Z'),
  },
];

export interface UseLocalTransfersReturn {
  transfers: LocalTransfer[];
  loading: boolean;
  error: string | null;
  startTransfer: (cloudDownloadId: string, name: string, sizeBytes: number) => void;
  removeTransfer: (id: string) => void;
  retryTransfer: (id: string) => void;
  refresh: () => Promise<void>;
  counts: {
    total: number;
    active: number;
    error: number;
  };
}

function simulateApiCall<T>(data: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), SIMULATED_DELAY_MS));
}

export function useLocalTransfers(): UseLocalTransfersReturn {
  const [transfers, setTransfers] = useState<LocalTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await simulateApiCall(MOCK_TRANSFERS);
      setTransfers(data);
    } catch {
      setError('Failed to load local transfers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startTransfer = useCallback(
    (cloudDownloadId: string, name: string, sizeBytes: number) => {
      const newTransfer: LocalTransfer = {
        id: `local-${Date.now()}`,
        name,
        status: 'queued',
        progress: 0,
        sizeBytes,
        destinationPath: '~/Downloads',
        cloudDownloadId,
        addedAt: new Date(),
      };
      setTransfers((prev) => [newTransfer, ...prev]);
    },
    [],
  );

  const removeTransfer = useCallback((id: string) => {
    setTransfers((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const retryTransfer = useCallback((id: string) => {
    setTransfers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: 'transferring', progress: 0, errorMessage: undefined } : t)),
    );
  }, []);

  const refresh = useCallback(async () => {
    await simulateApiCall(null);
  }, []);

  const counts = {
    total: transfers.length,
    active: transfers.filter((t) => t.status === 'transferring' || t.status === 'queued').length,
    error: transfers.filter((t) => t.status === 'error').length,
  };

  return {
    transfers,
    loading,
    error,
    startTransfer,
    removeTransfer,
    retryTransfer,
    refresh,
    counts,
  };
}
