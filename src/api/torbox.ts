import { invoke } from '@tauri-apps/api/core';
import type { CloudDownload, CloudDownloadStatus, CloudDownloadType } from '../types/downloads';

// ---------------------------------------------------------------------------
// Raw API response types (matching Rust structs)
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
  files: TorBoxFile[];
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
  files: TorBoxFile[];
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
  // Fallback: if not active, treat as paused; otherwise queued
  if (!active) {
    return { status: 'downloading', paused: true };
  }
  return { status: 'queued', paused: false };
}

// ---------------------------------------------------------------------------
// Shared fields mapping
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
  files: TorBoxFile[];
  error?: string | null;
}

function applySharedFields(download: CloudDownload, raw: SharedDownloadFields): void {
  download.name = raw.name;
  download.sizeBytes = raw.size;
  download.progress = Math.min(100, Math.max(0, raw.progress));
  download.speedBytesPerSec = raw.download_speed > 0 ? raw.download_speed : undefined;
  download.etaSeconds = raw.eta > 0 ? raw.eta : undefined;

  const mapping = mapDownloadState(raw.download_state, raw.active);
  download.status = mapping.status;
  download.paused = mapping.paused;

  if (raw.error) {
    download.errorMessage = raw.error;
  }

  download.fileCount = raw.files.length;

  if (raw.created_at) {
    download.addedAt = new Date(raw.created_at);
  }
}

// ---------------------------------------------------------------------------
// Type-specific mapping
// ---------------------------------------------------------------------------

function mapTorrentToCloudDownload(t: TorrentListData): CloudDownload {
  const download: CloudDownload = {
    id: `t-${t.id}`,
    name: t.name,
    type: 'torrent',
    status: 'queued',
    progress: 0,
    sizeBytes: t.size,
    addedAt: new Date(),
    fileCount: t.files.length,
    paused: false,
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
    sizeBytes: w.size,
    addedAt: new Date(),
    fileCount: w.files.length,
    paused: false,
  };

  applySharedFields(download, w);

  return download;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/** Fetch all cloud downloads (torrents + web). */
export async function fetchDownloads(apiKey: string): Promise<CloudDownload[]> {
  const [torrents, webDownloads] = await Promise.all([
    invoke<TorrentListData[]>('get_torrent_list', {
      apiKey,
      bypassCache: false,
      id: null,
      offset: null,
      limit: null,
    }),
    invoke<WebDownloadListData[]>('get_web_download_list', {
      apiKey,
      bypassCache: false,
      id: null,
      offset: null,
      limit: null,
    }),
  ]);

  const cloudDownloads: CloudDownload[] = [
    ...torrents.map(mapTorrentToCloudDownload),
    ...webDownloads.map(mapWebToCloudDownload),
  ];

  // Sort by most recently added first
  cloudDownloads.sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime());

  return cloudDownloads;
}

/** Add a torrent via magnet link. */
export async function addTorrentMagnet(apiKey: string, magnet: string): Promise<void> {
  await invoke('create_torrent_magnet', {
    apiKey,
    magnet,
    seed: 1,
    allowZip: false,
    name: null,
    asQueued: false,
    addOnlyIfCached: false,
  });
}

/** Add a web download via URL. */
export async function addWebDownload(apiKey: string, link: string): Promise<void> {
  await invoke('create_web_download', {
    apiKey,
    link,
    password: null,
    name: null,
    asQueued: false,
    addOnlyIfCached: false,
  });
}

/** Strip the prefix from a download ID to get the raw torrent/web ID. */
function rawId(id: string): number {
  return Number(id.slice(2));
}

/** Delete a torrent download. */
async function deleteTorrent(apiKey: string, torrentId: number): Promise<void> {
  await invoke('control_torrent', {
    apiKey,
    torrentId,
    operation: 'delete',
    all: false,
  });
}

/** Delete a web download. */
async function deleteWebDownload(apiKey: string, webId: number): Promise<void> {
  await invoke('control_web_download', {
    apiKey,
    webdlId: webId,
    operation: 'delete',
    all: false,
  });
}

/** Pause a torrent download (stop seeding). */
async function pauseTorrent(apiKey: string, torrentId: number): Promise<void> {
  await invoke('control_torrent', {
    apiKey,
    torrentId,
    operation: 'stop_seeding',
    all: false,
  });
}

/** Resume a torrent download. */
async function resumeTorrent(apiKey: string, torrentId: number): Promise<void> {
  await invoke('control_torrent', {
    apiKey,
    torrentId,
    operation: 'resume',
    all: false,
  });
}

/** Control a cloud download: pause, resume, or delete. */
export async function controlDownload(
  apiKey: string,
  id: string,
  type: CloudDownloadType,
  operation: 'pause' | 'resume' | 'delete'
): Promise<void> {
  const numericId = rawId(id);

  switch (operation) {
    case 'delete': {
      if (type === 'torrent') {
        await deleteTorrent(apiKey, numericId);
      } else {
        await deleteWebDownload(apiKey, numericId);
      }
      break;
    }
    case 'pause': {
      if (type === 'torrent') {
        await pauseTorrent(apiKey, numericId);
      }
      // Web downloads don't support pause
      break;
    }
    case 'resume': {
      if (type === 'torrent') {
        await resumeTorrent(apiKey, numericId);
      }
      // Web downloads don't support resume
      break;
    }
  }
}
