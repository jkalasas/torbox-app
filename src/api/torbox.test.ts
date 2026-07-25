import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { controlDownload, fetchDownloads, TorBoxApiError, validateApiKey } from './torbox';

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(),
}));

import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

const mockedFetch = vi.mocked(tauriFetch);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function torrentPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    auth_id: null,
    server: null,
    hash: 'abc',
    name: 'Test Torrent',
    magnet: null,
    size: 1024,
    active: true,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: null,
    download_state: 'downloading',
    seeds: 1,
    peers: 2,
    ratio: 0,
    progress: 0.5,
    download_speed: 2048,
    upload_speed: 0,
    eta: 60,
    torrent_file: false,
    expires_at: null,
    download_present: false,
    files: [],
    download_path: null,
    availability: 1,
    download_finished: false,
    tracker: null,
    total_uploaded: 0,
    total_downloaded: 512,
    cached: false,
    owner: null,
    seed_torrent: false,
    allow_zipped: false,
    long_term_seeding: false,
    tracker_message: null,
    cached_at: null,
    private: false,
    alternative_hashes: [],
    tags: [],
    ...overrides,
  };
}

describe('torbox API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateApiKey', () => {
    it('resolves when the user endpoint succeeds', async () => {
      mockedFetch.mockResolvedValue(
        jsonResponse({
          success: true,
          error: null,
          detail: 'ok',
          data: { id: 1, email: 'user@example.com' },
        })
      );

      await expect(validateApiKey('  valid-key  ')).resolves.toBeUndefined();

      expect(mockedFetch).toHaveBeenCalledWith(
        'https://api.torbox.app/v1/api/user/me?settings=false',
        expect.objectContaining({
          headers: { Authorization: 'Bearer valid-key' },
        })
      );
    });

    it('rejects empty keys without calling the network', async () => {
      await expect(validateApiKey('   ')).rejects.toMatchObject({
        name: 'TorBoxApiError',
        status: 400,
      });
      expect(mockedFetch).not.toHaveBeenCalled();
    });

    it('maps auth failures to TorBoxApiError', async () => {
      mockedFetch.mockResolvedValue(
        new Response('unauthorized', {
          status: 403,
          headers: { 'Content-Type': 'text/plain' },
        })
      );

      const error = await validateApiKey('bad-key').catch((err: unknown) => err);
      expect(error).toBeInstanceOf(TorBoxApiError);
      expect(error).toMatchObject({ status: 403 });
    });
  });

  describe('controlDownload', () => {
    it('sends operation "pause" (not stop_seeding) for torrent pause', async () => {
      mockedFetch.mockResolvedValue(
        jsonResponse({ success: true, error: null, detail: 'ok', data: null })
      );

      await controlDownload('test-key', 't-42', 'torrent', 'pause');

      expect(mockedFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockedFetch.mock.calls[0]!;
      expect(String(url)).toContain('torrents/controltorrent');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toEqual({
        torrent_id: 42,
        operation: 'pause',
        all: false,
      });
    });

    it('accepts success responses with null data for control operations', async () => {
      mockedFetch.mockResolvedValue(
        jsonResponse({ success: true, error: null, detail: 'Torrent paused', data: null })
      );

      await expect(controlDownload('test-key', 't-7', 'torrent', 'pause')).resolves.toBeUndefined();
    });

    it('sends resume and delete operations unchanged', async () => {
      mockedFetch.mockImplementation(async () =>
        jsonResponse({ success: true, error: null, detail: 'ok', data: null })
      );

      await controlDownload('test-key', 't-9', 'torrent', 'resume');
      expect(JSON.parse(String(mockedFetch.mock.calls[0]![1]?.body))).toMatchObject({
        operation: 'resume',
      });

      await controlDownload('test-key', 't-9', 'torrent', 'delete');
      expect(JSON.parse(String(mockedFetch.mock.calls[1]![1]?.body))).toMatchObject({
        operation: 'delete',
      });
    });
  });

  describe('fetchDownloads', () => {
    it('requests mylist with bypass_cache=true for live speed/progress', async () => {
      mockedFetch.mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('torrents/mylist')) {
          return jsonResponse({
            success: true,
            error: null,
            detail: 'ok',
            data: [torrentPayload({ download_speed: 4096 })],
          });
        }
        return jsonResponse({ success: true, error: null, detail: 'ok', data: [] });
      });

      await fetchDownloads('test-key');

      const urls = mockedFetch.mock.calls.map(([input]) => String(input));
      expect(urls.some((u) => u.includes('torrents/mylist?bypass_cache=true'))).toBe(true);
      expect(urls.some((u) => u.includes('webdl/mylist?bypass_cache=true'))).toBe(true);
    });

    it('maps stalled and paused TorBox states to downloadable statuses', async () => {
      mockedFetch.mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('torrents/mylist')) {
          return jsonResponse({
            success: true,
            error: null,
            detail: 'ok',
            data: [
              torrentPayload({
                id: 1,
                name: 'Stalled',
                download_state: 'stalled (no seeds)',
                active: true,
                download_speed: 0,
              }),
              torrentPayload({
                id: 2,
                name: 'Paused',
                download_state: 'paused',
                active: false,
                download_speed: 0,
              }),
              torrentPayload({
                id: 3,
                name: 'Meta',
                download_state: 'metaDL',
                active: true,
                download_speed: 128,
              }),
            ],
          });
        }
        return jsonResponse({ success: true, error: null, detail: 'ok', data: [] });
      });

      const downloads = await fetchDownloads('test-key');
      const byName = Object.fromEntries(downloads.map((d) => [d.name, d]));

      expect(byName.Stalled).toMatchObject({
        status: 'downloading',
        paused: false,
      });
      expect(byName.Paused).toMatchObject({
        status: 'downloading',
        paused: true,
      });
      expect(byName.Meta).toMatchObject({
        status: 'downloading',
        paused: false,
        speedBytesPerSec: 128,
      });
    });
  });
});
