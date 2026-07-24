import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useCallback, useEffect, useState } from 'react';
import type { LocalTransfer } from '../types/downloads';

interface ProgressPayload {
  download_id: string;
  progress: number;
  speed_bytes_per_sec: number | null;
  eta_seconds: number | null;
}

interface CompletePayload {
  download_id: string;
  path: string;
}

interface ErrorPayload {
  download_id: string;
  message: string;
}

interface QueuedPayload {
  download_id: string;
  position: number;
}

interface PausedPayload {
  download_id: string;
}

export interface UseLocalTransfersReturn {
  transfers: LocalTransfer[];
  loading: boolean;
  error: string | null;
  startTransfer: (
    cloudDownloadId: string,
    cloudDownloadType: string,
    name: string,
    sizeBytes: number,
    fileIds?: number[]
  ) => Promise<void>;
  pauseTransfer: (id: string) => Promise<void>;
  resumeTransfer: (id: string) => Promise<void>;
  removeTransfer: (id: string, options?: { deleteLocalFile?: boolean }) => Promise<void>;
  retryTransfer: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  counts: {
    total: number;
    active: number;
    error: number;
  };
}

export function mapRustToTransfer(raw: Record<string, unknown>): LocalTransfer {
  const rustStatus = raw.status as string;
  const statusMap: Record<string, LocalTransfer['status']> = {
    queued: 'queued',
    downloading: 'transferring',
    complete: 'complete',
    // Keep paused transfers under transferring so they remain visible/actionable.
    paused: 'transferring',
    error: 'error',
  };

  return {
    id: raw.id as string,
    name: raw.name as string,
    status: statusMap[rustStatus] ?? 'queued',
    progress: ((raw.progress as number) ?? 0) * 100,
    sizeBytes: (raw.size_bytes as number) ?? 0,
    speedBytesPerSec: (raw.speed_bytes_per_sec as number) ?? undefined,
    etaSeconds: (raw.eta_seconds as number) ?? undefined,
    errorMessage: (raw.error_message as string) ?? undefined,
    paused: rustStatus === 'paused',
    destinationPath: (raw.destination_path as string) ?? '',
    cloudDownloadId: (raw.cloud_download_id as string) ?? '',
    addedAt: new Date((raw.added_at as number | string | undefined) ?? Date.now()),
  };
}

export function useLocalTransfers(): UseLocalTransfersReturn {
  const [transfers, setTransfers] = useState<LocalTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await invoke<Record<string, unknown>[]>('list_downloads', {});
      setTransfers(raw.map(mapRustToTransfer));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Listen for Tauri events
  useEffect(() => {
    let active = true;
    const unlisteners: UnlistenFn[] = [];

    const setupListeners = async () => {
      const pending: Promise<UnlistenFn>[] = [];

      pending.push(
        listen<ProgressPayload>('download-progress', (event) => {
          if (!active) {
            return;
          }
          setTransfers((prev) =>
            prev.map((t) => {
              if (t.id !== event.payload.download_id) {
                return t;
              }
              // In-flight chunk progress can arrive after pause is requested.
              // Keep the paused UI stable and only refresh progress bytes.
              if (t.paused) {
                return {
                  ...t,
                  progress: event.payload.progress * 100,
                };
              }
              return {
                ...t,
                status: 'transferring',
                paused: false,
                progress: event.payload.progress * 100,
                speedBytesPerSec: event.payload.speed_bytes_per_sec ?? undefined,
                etaSeconds: event.payload.eta_seconds ?? undefined,
              };
            })
          );
        })
      );

      pending.push(
        listen<CompletePayload>('download-complete', (event) => {
          if (!active) {
            return;
          }
          setTransfers((prev) =>
            prev.map((t) =>
              t.id === event.payload.download_id
                ? {
                    ...t,
                    status: 'complete',
                    paused: false,
                    progress: 100,
                    destinationPath: event.payload.path,
                  }
                : t
            )
          );
        })
      );

      pending.push(
        listen<ErrorPayload>('download-error', (event) => {
          if (!active) {
            return;
          }
          setTransfers((prev) =>
            prev.map((t) =>
              t.id === event.payload.download_id
                ? {
                    ...t,
                    status: 'error',
                    paused: false,
                    errorMessage: event.payload.message,
                  }
                : t
            )
          );
        })
      );

      pending.push(
        listen<PausedPayload>('download-paused', (event) => {
          if (!active) {
            return;
          }
          setTransfers((prev) =>
            prev.map((t) =>
              t.id === event.payload.download_id
                ? {
                    ...t,
                    status: 'transferring',
                    paused: true,
                    speedBytesPerSec: undefined,
                    etaSeconds: undefined,
                  }
                : t
            )
          );
        })
      );

      pending.push(
        listen<QueuedPayload>('download-queued', () => {
          if (!active) {
            return;
          }
          void load();
        })
      );

      const unlistenFns = await Promise.all(pending);
      if (!active) {
        unlistenFns.forEach((fn) => fn());
        return;
      }
      unlisteners.push(...unlistenFns);
    };

    void setupListeners();

    return () => {
      active = false;
      unlisteners.forEach((fn) => fn());
    };
  }, [load]);

  const startTransfer = useCallback(
    async (
      cloudDownloadId: string,
      cloudDownloadType: string,
      name: string,
      sizeBytes: number,
      fileIds?: number[]
    ) => {
      try {
        await invoke('start_download', {
          args: {
            cloud_download_id: cloudDownloadId,
            cloud_download_type: cloudDownloadType,
            name,
            size_bytes: sizeBytes,
            file_ids: fileIds ?? null,
          },
        });
      } catch (e) {
        setError(String(e));
      }
    },
    []
  );

  const pauseTransfer = useCallback(
    async (id: string) => {
      // Optimistic: mark paused immediately so late progress events cannot flip the UI back.
      setTransfers((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                status: 'transferring',
                paused: true,
                speedBytesPerSec: undefined,
                etaSeconds: undefined,
              }
            : t
        )
      );

      try {
        await invoke('pause_download', { downloadId: id });
      } catch (e) {
        setError(String(e));
        // Re-sync from backend if pause failed.
        void load();
      }
    },
    [load]
  );

  const resumeTransfer = useCallback(async (id: string) => {
    try {
      await invoke('resume_download', { downloadId: id });
      setTransfers((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                status: 'queued',
                paused: false,
                errorMessage: undefined,
                speedBytesPerSec: undefined,
                etaSeconds: undefined,
              }
            : t
        )
      );
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const removeTransfer = useCallback(
    async (id: string, options?: { deleteLocalFile?: boolean }) => {
      try {
        await invoke('cancel_download', { downloadId: id });
        await invoke('remove_download', {
          downloadId: id,
          deleteLocalFile: options?.deleteLocalFile ?? false,
        });
        setTransfers((prev) => prev.filter((t) => t.id !== id));
      } catch (e) {
        setError(String(e));
      }
    },
    []
  );

  const retryTransfer = useCallback(async (id: string) => {
    try {
      await invoke('resume_download', { downloadId: id });
      setTransfers((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                status: 'queued',
                paused: false,
                errorMessage: undefined,
                speedBytesPerSec: undefined,
                etaSeconds: undefined,
              }
            : t
        )
      );
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

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
    pauseTransfer,
    resumeTransfer,
    removeTransfer,
    retryTransfer,
    refresh,
    counts,
  };
}
