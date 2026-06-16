import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchDownloads } from '../api/torbox';
import { getCachedDownloads, saveDownloadsCache } from '../cache/downloadsCache';
import type { CloudDownloadStatus } from '../types/downloads';
import { useDownloads } from './useDownloads';

vi.mock('../api/torbox', () => ({ fetchDownloads: vi.fn() }));
vi.mock('../cache/downloadsCache', () => ({
  getCachedDownloads: vi.fn(),
  saveDownloadsCache: vi.fn().mockResolvedValue(undefined),
}));

const mockedFetchDownloads = vi.mocked(fetchDownloads);
const mockedGetCachedDownloads = vi.mocked(getCachedDownloads);
const mockedSaveDownloadsCache = vi.mocked(saveDownloadsCache);

function createDownload(
  id: number,
  type: 'torrent' | 'web' = 'torrent',
  status: CloudDownloadStatus = 'cached'
) {
  return {
    id: `${type === 'torrent' ? 't' : 'w'}-${id}`,
    name: `Download ${id}`,
    type,
    status,
    progress: 100,
    sizeBytes: 1000,
    addedAt: new Date(`2024-01-0${id}T00:00:00.000Z`),
    fileCount: 0,
    files: [],
    paused: false,
    cached: true,
  };
}

describe('useDownloads', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockedSaveDownloadsCache.mockResolvedValue(undefined);
  });

  it('should show cached entries immediately and then refresh in the background', async () => {
    const cached = [createDownload(1)];
    const fresh = [createDownload(1), createDownload(2)];
    const deferred = createDeferred<ReturnType<typeof createDownload>[]>();

    mockedGetCachedDownloads.mockResolvedValue(cached);
    mockedFetchDownloads.mockImplementation(() => deferred.promise);

    const { result } = renderHook(() => useDownloads('test-api-key'));

    // Cached data should be shown before the API responds
    await waitFor(() => expect(result.current.downloads).toHaveLength(1));
    expect(result.current.downloads[0].name).toBe('Download 1');

    await act(async () => {
      deferred.resolve(fresh);
    });

    await waitFor(() => expect(result.current.downloads).toHaveLength(2));
    expect(result.current.downloads[1].name).toBe('Download 2');
    expect(result.current.error).toBeNull();
  });

  it('should keep cached entries visible when the API fetch fails', async () => {
    const cached = [createDownload(1)];
    mockedGetCachedDownloads.mockResolvedValue(cached);
    mockedFetchDownloads.mockRejectedValue(new Error('Network failure'));

    const { result } = renderHook(() => useDownloads('test-api-key'));

    await waitFor(() => expect(result.current.error).toBe('Network failure'));
    expect(result.current.downloads).toHaveLength(1);
    expect(result.current.downloads[0].name).toBe('Download 1');
  });

  it('should not stack concurrent refresh calls', async () => {
    mockedGetCachedDownloads.mockResolvedValue([]);

    const deferred = createDeferred<ReturnType<typeof createDownload>[]>();
    mockedFetchDownloads.mockImplementation(() => deferred.promise);

    const { result } = renderHook(() => useDownloads('test-api-key'));

    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(mockedFetchDownloads).toHaveBeenCalledTimes(1);

    // Fire several refreshes while the first fetch is still in flight
    await act(async () => {
      result.current.refresh();
    });
    await act(async () => {
      result.current.refresh();
    });
    await act(async () => {
      result.current.refresh();
    });

    // Still only one API call because later refreshes join the in-flight one
    expect(mockedFetchDownloads).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.resolve([createDownload(1)]);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.downloads).toHaveLength(1);
  });

  it('should cancel the previous fetch when the API key changes', async () => {
    mockedGetCachedDownloads.mockResolvedValue([]);

    const firstDeferred = createDeferred<ReturnType<typeof createDownload>[]>();
    const secondDeferred = createDeferred<ReturnType<typeof createDownload>[]>();

    mockedFetchDownloads
      .mockImplementationOnce(() => firstDeferred.promise)
      .mockImplementationOnce(() => secondDeferred.promise);

    const { result, rerender } = renderHook(
      ({ apiKey }: { apiKey: string }) => useDownloads(apiKey),
      {
        initialProps: { apiKey: 'first-key' },
      }
    );

    await waitFor(() => expect(result.current.loading).toBe(true));

    rerender({ apiKey: 'second-key' });

    await waitFor(() => expect(mockedFetchDownloads).toHaveBeenCalledTimes(2));

    // Resolve the stale fetch first
    await act(async () => {
      firstDeferred.resolve([createDownload(1)]);
    });

    // Resolve the fresh fetch
    await act(async () => {
      secondDeferred.resolve([createDownload(2)]);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.downloads).toHaveLength(1);
    expect(result.current.downloads[0].name).toBe('Download 2');
  });

  it('should refresh in the background via polling without flashing the loading skeleton', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    mockedGetCachedDownloads.mockResolvedValue([]);

    const initialDeferred = createDeferred<ReturnType<typeof createDownload>[]>();
    mockedFetchDownloads.mockImplementation(() => initialDeferred.promise);

    const { result } = renderHook(() => useDownloads('test-api-key'));

    await waitFor(() => expect(result.current.loading).toBe(true));

    // Resolve initial fetch with an active download so polling starts
    await act(async () => {
      initialDeferred.resolve([createDownload(1, 'torrent', 'downloading')]);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.downloads[0].status).toBe('downloading');

    // Set up the next poll response
    const pollDeferred = createDeferred<ReturnType<typeof createDownload>[]>();
    mockedFetchDownloads.mockImplementation(() => pollDeferred.promise);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    // Polling refresh should not flip loading back to true
    expect(result.current.loading).toBe(false);

    await act(async () => {
      pollDeferred.resolve([createDownload(1)]);
    });

    await waitFor(() => expect(result.current.downloads[0].status).toBe('cached'));
    expect(result.current.loading).toBe(false);
  });
});

function createDeferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason?: unknown) => void = () => {};

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}
