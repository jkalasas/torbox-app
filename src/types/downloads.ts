/** Status for TorBox cloud-side downloads */
export type CloudDownloadStatus = 'queued' | 'downloading' | 'cached' | 'error';

/** Type of cloud download source */
export type CloudDownloadType = 'torrent' | 'web';

/** Status for local device transfers */
export type LocalTransferStatus = 'queued' | 'transferring' | 'complete' | 'error';

/** File info within a cloud download */
export interface FileInfo {
  id: number;
  name: string;
  sizeBytes: number;
  mimeType: string | null;
  infected: boolean;
  shortName: string | null;
}

/** A TorBox cloud-side download */
export interface CloudDownload {
  id: string;
  name: string;
  type: CloudDownloadType;
  status: CloudDownloadStatus;
  progress: number; // 0-100
  sizeBytes: number;
  speedBytesPerSec?: number;
  etaSeconds?: number;
  errorMessage?: string;
  /** Torrent-specific metadata */
  seeders?: number;
  peers?: number;
  /** When the download was added */
  addedAt: Date;
  /** Number of files in the download */
  fileCount: number;
  /** Files within the download (available when cached/complete) */
  files: FileInfo[];
  /** Whether the download is paused */
  paused: boolean;
  /** Whether the content was already cached in TorBox when added (instant availability) */
  cached: boolean;
}

/** A local device transfer (TorBox cache → device) */
export interface LocalTransfer {
  id: string;
  name: string;
  status: LocalTransferStatus;
  progress: number; // 0-100
  sizeBytes: number;
  speedBytesPerSec?: number;
  etaSeconds?: number;
  errorMessage?: string;
  /** Local destination path */
  destinationPath?: string;
  /** Reference to the cloud download this came from */
  cloudDownloadId: string;
  addedAt: Date;
}

/** Active view tab */
export type DownloadTab = 'cloud' | 'local';

/** Cloud sub-tab */
export type CloudSubTab = 'torrents' | 'web';

/** Frontend-facing settings synchronized with Rust */
export interface DownloadSettings {
  api_key: string;
  download_dir: string;
  max_concurrent: number;
  bandwidth_limit: number; // KB/s, 0 = unlimited
  notify_on_complete: boolean;
  open_folder_on_complete: boolean;
}
