import { fetch } from '@tauri-apps/plugin-http';
import type {
  CloudDownload,
  CloudDownloadStatus,
  CloudDownloadType,
  FileInfo,
} from '../types/downloads';

// ---------------------------------------------------------------------------
// API client helpers
// ---------------------------------------------------------------------------

const API_BASE = 'https://api.torbox.app/v1/api';

class TorBoxApiError extends Error {
  status: number | undefined;
  errorCode: string | undefined;

  constructor(message: string, status?: number, errorCode?: string) {
    super(message);
    this.name = 'TorBoxApiError';
    this.status = status;
    this.errorCode = errorCode;
  }
}

interface TorBoxEnvelope<T> {
  success: boolean;
  error: string | null;
  detail: string;
  data: T | null;
}

async function extractData<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new TorBoxApiError(`HTTP ${response.status}: ${text}`, response.status);
  }

  const envelope = (await response.json()) as TorBoxEnvelope<T>;

  if (!envelope.success) {
    throw new TorBoxApiError(
      envelope.detail || envelope.error || 'Unknown API error',
      response.status,
      envelope.error ?? undefined
    );
  }

  if (envelope.data === null || envelope.data === undefined) {
    throw new TorBoxApiError('API returned success but no data', response.status);
  }

  return envelope.data;
}

/** The TorBox list endpoints return an array when no `id` is given,
 *  but a single object when `id` is specified. Normalize to array. */
function normalizeList<T>(data: unknown): T[] {
  if (Array.isArray(data)) {
    return data as T[];
  }
  return [data as T];
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

function isRetryableError(err: unknown): boolean {
  if (err instanceof TorBoxApiError) {
    return err.status === undefined || err.status >= 500 || err.status === 429;
  }
  return err instanceof Error && err.name !== 'AbortError';
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiGet<T>(apiKey: string, path: string, signal?: AbortSignal): Promise<T> {
  let lastError: Error = new Error('Unknown error');

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    if (signal?.aborted) {
      const abortedError = new Error('Request aborted');
      abortedError.name = 'AbortError';
      throw abortedError;
    }

    try {
      const response = await fetch(`${API_BASE}/${path}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal,
      });
      return extractData<T>(response);
    } catch (err) {
      lastError = err instanceof Error ? err : new TorBoxApiError(String(err));
      if (signal?.aborted || !isRetryableError(err) || attempt === MAX_RETRIES) {
        break;
      }
      await sleep(RETRY_DELAY_MS * (attempt + 1));
    }
  }

  throw lastError;
}

async function apiPostForm(apiKey: string, path: string, form: FormData): Promise<void> {
  const response = await fetch(`${API_BASE}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  await extractData<unknown>(response);
}

async function apiPostJson(
  apiKey: string,
  path: string,
  body: Record<string, unknown>
): Promise<void> {
  const response = await fetch(`${API_BASE}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  await extractData<unknown>(response);
}

// ---------------------------------------------------------------------------
// Raw API response types (matching TorBox API JSON)
// ---------------------------------------------------------------------------

interface TorBoxFile {
  id: number;
  md5: string | null;
  hash: string | null;
  name: string;
  size: number;
  zipped: boolean;
  s3_path: string | null;
  infected: boolean;
  mimetype: string | null;
  short_name: string | null;
  absolute_path: string | null;
  opensubtitles_hash: string | null;
}

interface TorrentListData {
  id: number;
  auth_id: string | null;
  server: number | null;
  hash: string | null;
  name: string;
  magnet: string | null;
  size: number;
  active: boolean;
  created_at: string | null;
  updated_at: string | null;
  download_state: string | null;
  seeds: number;
  peers: number;
  ratio: number;
  progress: number;
  download_speed: number;
  upload_speed: number;
  eta: number;
  torrent_file: boolean;
  expires_at: string | null;
  download_present: boolean;
  files: TorBoxFile[] | null;
  download_path: string | null;
  availability: number;
  download_finished: boolean;
  tracker: string | null;
  total_uploaded: number;
  total_downloaded: number;
  cached: boolean;
  owner: string | null;
  seed_torrent: boolean;
  allow_zipped: boolean;
  long_term_seeding: boolean;
  tracker_message: string | null;
  cached_at: string | null;
  private: boolean;
  alternative_hashes: string[];
  tags: string[];
}

interface WebDownloadListData {
  id: number;
  created_at: string | null;
  updated_at: string | null;
  auth_id: string | null;
  name: string;
  hash: string | null;
  download_state: string | null;
  download_speed: number;
  original_url: string | null;
  eta: number;
  progress: number;
  size: number;
  download_id: string | null;
  files: TorBoxFile[] | null;
  active: boolean;
  cached: boolean;
  download_present: boolean;
  download_finished: boolean;
  expires_at: string | null;
  error: string | null;
  cached_at: string | null;
  server: number | null;
  alternative_hashes: string[];
  tags: string[];
}

// ---------------------------------------------------------------------------
// State mapping
// ---------------------------------------------------------------------------

interface StateMapping {
  status: CloudDownloadStatus;
  paused: boolean;
}

const STATE_MAP: Record<string, StateMapping> = {
  metaDL: { status: 'queued', paused: false },
  queued: { status: 'queued', paused: false },
  downloading: { status: 'downloading', paused: false },
  uploading: { status: 'cached', paused: false },
  completed: { status: 'cached', paused: false },
  cached: { status: 'cached', paused: false },
  error: { status: 'error', paused: false },
  dead: { status: 'error', paused: false },
  stopped: { status: 'downloading', paused: true },
};

function mapDownloadState(state: string | null | undefined, active: boolean): StateMapping {
  if (state && STATE_MAP[state]) {
    return STATE_MAP[state];
  }
  if (!active) {
    return { status: 'downloading', paused: true };
  }
  return { status: 'queued', paused: false };
}

// ---------------------------------------------------------------------------
// Response → CloudDownload mapping
// ---------------------------------------------------------------------------

interface SharedDownloadFields {
  name: string;
  size: number;
  progress: number;
  download_speed: number;
  eta: number;
  download_state: string | null;
  active: boolean;
  created_at: string | null;
  files: TorBoxFile[] | null;
  error?: string | null;
  cached?: boolean;
}

function safeNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function applySharedFields(download: CloudDownload, raw: SharedDownloadFields): void {
  download.name = raw.name;
  download.sizeBytes = safeNum(raw.size);
  // TorBox API returns progress as a 0–1 decimal, not 0–100 percentage
  download.progress = Math.min(100, Math.max(0, safeNum(raw.progress) * 100));
  download.speedBytesPerSec =
    safeNum(raw.download_speed) > 0 ? Number(raw.download_speed) : undefined;
  download.etaSeconds = safeNum(raw.eta) > 0 ? Number(raw.eta) : undefined;

  const mapping = mapDownloadState(raw.download_state, raw.active);
  download.status = mapping.status;
  download.paused = mapping.paused;

  if (raw.error) {
    download.errorMessage = raw.error;
  }

  download.fileCount = raw.files?.length ?? 0;
  // Propagate the API's cache flag: whether content was already cached at TorBox
  download.cached = raw.cached ?? false;

  if (raw.created_at) {
    download.addedAt = new Date(raw.created_at);
  }
}

function mapTorBoxFile(f: TorBoxFile): FileInfo {
  return {
    id: f.id,
    name: f.name,
    sizeBytes: safeNum(f.size),
    mimeType: f.mimetype,
    infected: f.infected,
    shortName: f.short_name,
  };
}

function mapTorrentToCloudDownload(t: TorrentListData): CloudDownload {
  const download: CloudDownload = {
    id: `t-${t.id}`,
    name: t.name,
    type: 'torrent',
    status: 'queued',
    progress: 0,
    sizeBytes: safeNum(t.size),
    addedAt: new Date(),
    fileCount: t.files?.length ?? 0,
    files: t.files?.map(mapTorBoxFile) ?? [],
    paused: false,
    cached: false,
    seeders: t.seeds,
    peers: t.peers,
  };
  applySharedFields(download, t);
  return download;
}

function mapWebToCloudDownload(w: WebDownloadListData): CloudDownload {
  const download: CloudDownload = {
    id: `w-${w.id}`,
    name: w.name,
    type: 'web',
    status: 'queued',
    progress: 0,
    sizeBytes: safeNum(w.size),
    addedAt: new Date(),
    fileCount: w.files?.length ?? 0,
    files: w.files?.map(mapTorBoxFile) ?? [],
    paused: false,
    cached: false,
  };
  applySharedFields(download, w);
  return download;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Fetch all cloud downloads (torrents + web).
 *  If one endpoint fails, the other endpoint's data is still returned so the
 *  UI remains usable during partial API instability. */
export async function fetchDownloads(
  apiKey: string,
  signal?: AbortSignal
): Promise<CloudDownload[]> {
  const [torrentsResult, webDownloadsResult] = await Promise.allSettled([
    apiGet<unknown>(apiKey, 'torrents/mylist', signal).then(normalizeList<TorrentListData>),
    apiGet<unknown>(apiKey, 'webdl/mylist', signal).then(normalizeList<WebDownloadListData>),
  ]);

  const torrents = torrentsResult.status === 'fulfilled' ? torrentsResult.value : [];
  const webDownloads = webDownloadsResult.status === 'fulfilled' ? webDownloadsResult.value : [];

  // If both endpoints failed, surface the first error so the caller knows the
  // refresh truly failed. A single endpoint failure is treated as partial success.
  if (torrentsResult.status === 'rejected' && webDownloadsResult.status === 'rejected') {
    throw torrentsResult.reason;
  }

  const all: CloudDownload[] = [
    ...torrents.map(mapTorrentToCloudDownload),
    ...webDownloads.map(mapWebToCloudDownload),
  ];

  all.sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime());
  return all;
}

/** Add a torrent via magnet link. */
export async function addTorrentMagnet(apiKey: string, magnet: string): Promise<void> {
  const form = new FormData();
  form.append('magnet', magnet);
  form.append('seed', '1');
  form.append('allow_zip', 'false');
  form.append('as_queued', 'false');

  await apiPostForm(apiKey, 'torrents/createtorrent', form);
}

/** Add a web download via URL. */
export async function addWebDownload(apiKey: string, link: string): Promise<void> {
  const form = new FormData();
  form.append('link', link);
  form.append('as_queued', 'false');

  await apiPostForm(apiKey, 'webdl/createwebdownload', form);
}

/** Control a cloud download: pause, resume, or delete. */
export async function controlDownload(
  apiKey: string,
  id: string,
  type: CloudDownloadType,
  operation: 'pause' | 'resume' | 'delete'
): Promise<void> {
  const numericId = Number(id.slice(2));

  if (type === 'torrent') {
    const op = operation === 'pause' ? 'stop_seeding' : (operation as string);
    await apiPostJson(apiKey, 'torrents/controltorrent', {
      torrent_id: numericId,
      operation: op,
      all: false,
    });
  } else {
    // Web downloads only support delete
    if (operation !== 'delete') {
      return;
    }
    await apiPostJson(apiKey, 'webdl/controlwebdownload', {
      webdl_id: numericId,
      operation: 'delete',
      all: false,
    });
  }
}

/** Request a temporary download link for a file within a download.
 *  The TorBox requestdl endpoints require GET with query parameters.
 */
export async function requestFileDownloadLink(
  apiKey: string,
  type: CloudDownloadType,
  downloadId: number,
  fileId: number
): Promise<string> {
  const path = type === 'torrent' ? 'torrents/requestdl' : 'webdl/requestdl';
  const idKey = type === 'torrent' ? 'torrent_id' : 'web_id';

  const params = new URLSearchParams({
    token: apiKey,
    [idKey]: String(downloadId),
    file_id: String(fileId),
  });

  const response = await fetch(`${API_BASE}/${path}?${params.toString()}`);

  return extractData<string>(response);
}

export { TorBoxApiError };
