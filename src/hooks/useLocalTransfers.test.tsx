import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mapRustToTransfer, useLocalTransfers } from './useLocalTransfers';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

type EventHandler = (event: { payload: Record<string, unknown> }) => void;

const listeners = new Map<string, EventHandler>();

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (event: string, handler: EventHandler) => {
    listeners.set(event, handler);
    return () => {
      listeners.delete(event);
    };
  }),
}));

import { invoke } from '@tauri-apps/api/core';

const mockedInvoke = vi.mocked(invoke);

function emit(event: string, payload: Record<string, unknown>) {
  const handler = listeners.get(event);
  if (!handler) {
    throw new Error(`No listener registered for ${event}`);
  }
  handler({ payload });
}

describe('mapRustToTransfer', () => {
  it('maps downloading status to transferring with progress percent', () => {
    const transfer = mapRustToTransfer({
      id: 'local-1',
      name: 'movie.mkv',
      status: 'downloading',
      progress: 0.42,
      size_bytes: 1000,
      speed_bytes_per_sec: 512,
      eta_seconds: 10,
      cloud_download_id: 't-1',
      destination_path: '/tmp',
      added_at: 1_700_000_000_000,
    });

    expect(transfer).toMatchObject({
      id: 'local-1',
      status: 'transferring',
      progress: 42,
      speedBytesPerSec: 512,
      paused: false,
    });
  });

  it('keeps paused transfers visible and flagged for resume', () => {
    const transfer = mapRustToTransfer({
      id: 'local-2',
      name: 'movie.mkv',
      status: 'paused',
      progress: 0.5,
      size_bytes: 1000,
      cloud_download_id: 't-1',
      destination_path: '/tmp',
      added_at: 1_700_000_000_000,
    });

    expect(transfer).toMatchObject({
      status: 'transferring',
      paused: true,
      progress: 50,
    });
  });
});

describe('useLocalTransfers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listeners.clear();
    mockedInvoke.mockImplementation(async (cmd) => {
      if (cmd === 'list_downloads') {
        return [];
      }
      return undefined;
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('pauses a local transfer via the Tauri pause_download command', async () => {
    mockedInvoke.mockImplementation(async (cmd) => {
      if (cmd === 'list_downloads') {
        return [
          {
            id: 'local-1',
            name: 'movie.mkv',
            status: 'downloading',
            progress: 0.2,
            size_bytes: 1000,
            speed_bytes_per_sec: 1024,
            cloud_download_id: 't-1',
            destination_path: '/tmp',
            added_at: 1_700_000_000_000,
          },
        ];
      }
      return undefined;
    });

    const { result } = renderHook(() => useLocalTransfers());

    await waitFor(() => expect(result.current.transfers).toHaveLength(1));
    expect(result.current.transfers[0]?.paused).toBe(false);

    await act(async () => {
      await result.current.pauseTransfer('local-1');
    });

    expect(mockedInvoke).toHaveBeenCalledWith('pause_download', { downloadId: 'local-1' });
    expect(result.current.transfers[0]).toMatchObject({
      id: 'local-1',
      status: 'transferring',
      paused: true,
      speedBytesPerSec: undefined,
    });
  });

  it('does not unpause when late progress events arrive after pause', async () => {
    mockedInvoke.mockImplementation(async (cmd) => {
      if (cmd === 'list_downloads') {
        return [
          {
            id: 'local-1',
            name: 'movie.mkv',
            status: 'downloading',
            progress: 0.2,
            size_bytes: 1000,
            speed_bytes_per_sec: 1024,
            cloud_download_id: 't-1',
            destination_path: '/tmp',
            added_at: 1_700_000_000_000,
          },
        ];
      }
      return undefined;
    });

    const { result } = renderHook(() => useLocalTransfers());
    await waitFor(() => expect(result.current.transfers).toHaveLength(1));
    await waitFor(() => expect(listeners.has('download-progress')).toBe(true));

    await act(async () => {
      await result.current.pauseTransfer('local-1');
    });

    await act(async () => {
      emit('download-progress', {
        download_id: 'local-1',
        progress: 0.35,
        speed_bytes_per_sec: 9999,
        eta_seconds: 5,
      });
    });

    expect(result.current.transfers[0]).toMatchObject({
      paused: true,
      progress: 35,
      speedBytesPerSec: undefined,
    });
  });

  it('applies download-paused events from the backend', async () => {
    mockedInvoke.mockImplementation(async (cmd) => {
      if (cmd === 'list_downloads') {
        return [
          {
            id: 'local-1',
            name: 'movie.mkv',
            status: 'downloading',
            progress: 0.2,
            size_bytes: 1000,
            cloud_download_id: 't-1',
            destination_path: '/tmp',
            added_at: 1_700_000_000_000,
          },
        ];
      }
      return undefined;
    });

    const { result } = renderHook(() => useLocalTransfers());
    await waitFor(() => expect(result.current.transfers).toHaveLength(1));
    await waitFor(() => expect(listeners.has('download-paused')).toBe(true));

    await act(async () => {
      emit('download-paused', { download_id: 'local-1' });
    });

    expect(result.current.transfers[0]).toMatchObject({
      status: 'transferring',
      paused: true,
      speedBytesPerSec: undefined,
    });
  });

  it('resumes a paused local transfer via resume_download', async () => {
    mockedInvoke.mockImplementation(async (cmd) => {
      if (cmd === 'list_downloads') {
        return [
          {
            id: 'local-1',
            name: 'movie.mkv',
            status: 'paused',
            progress: 0.2,
            size_bytes: 1000,
            cloud_download_id: 't-1',
            destination_path: '/tmp',
            added_at: 1_700_000_000_000,
          },
        ];
      }
      return undefined;
    });

    const { result } = renderHook(() => useLocalTransfers());
    await waitFor(() => expect(result.current.transfers[0]?.paused).toBe(true));

    await act(async () => {
      await result.current.resumeTransfer('local-1');
    });

    expect(mockedInvoke).toHaveBeenCalledWith('resume_download', { downloadId: 'local-1' });
    expect(result.current.transfers[0]).toMatchObject({
      status: 'queued',
      paused: false,
    });
  });

  it('removes a transfer only after backend succeeds', async () => {
    let removed = false;
    mockedInvoke.mockImplementation(async (cmd) => {
      if (cmd === 'list_downloads') {
        if (removed) {
          return [];
        }
        return [
          {
            id: 'local-1',
            name: 'movie.mkv',
            status: 'complete',
            progress: 1,
            size_bytes: 1000,
            cloud_download_id: 't-1',
            destination_path: '/tmp',
            added_at: 1_700_000_000_000,
          },
        ];
      }
      if (cmd === 'remove_download') {
        removed = true;
        return undefined;
      }
      return undefined;
    });

    const { result } = renderHook(() => useLocalTransfers());
    await waitFor(() => expect(result.current.transfers).toHaveLength(1));

    await act(async () => {
      await result.current.removeTransfer('local-1', { deleteLocalFile: true });
    });

    expect(mockedInvoke).not.toHaveBeenCalledWith('cancel_download', expect.anything());
    expect(mockedInvoke).toHaveBeenCalledWith('remove_download', {
      downloadId: 'local-1',
      deleteLocalFile: true,
    });
    expect(result.current.transfers).toHaveLength(0);
  });

  it('keeps the transfer visible when remove_download fails', async () => {
    mockedInvoke.mockImplementation(async (cmd) => {
      if (cmd === 'list_downloads') {
        return [
          {
            id: 'local-1',
            name: 'movie.mkv',
            status: 'complete',
            progress: 1,
            size_bytes: 1000,
            cloud_download_id: 't-1',
            destination_path: '/tmp',
            added_at: 1_700_000_000_000,
          },
        ];
      }
      if (cmd === 'remove_download') {
        throw new Error('disk busy');
      }
      return undefined;
    });

    const { result } = renderHook(() => useLocalTransfers());
    await waitFor(() => expect(result.current.transfers).toHaveLength(1));

    await act(async () => {
      await result.current.removeTransfer('local-1', { deleteLocalFile: true });
    });

    expect(result.current.transfers).toHaveLength(1);
    expect(result.current.transfers[0]?.id).toBe('local-1');
    expect(result.current.error).toContain('disk busy');
  });
});
