import Database from '@tauri-apps/plugin-sql';
import type { CloudDownload } from '../types/downloads';

// ---------------------------------------------------------------------------
// Database singleton
// ---------------------------------------------------------------------------

let db: Database | null = null;
let initPromise: Promise<Database> | null = null;

/** Open (or reuse) the SQLite downloads database. */
async function getDb(): Promise<Database> {
  if (db) {
    return db;
  }
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const database = await Database.load('sqlite:torbox_downloads.db');

    // Create the downloads table if it doesn't exist
    await database.execute(
      `CREATE TABLE IF NOT EXISTS downloads (
        id           TEXT PRIMARY KEY,
        name         TEXT    NOT NULL,
        type         TEXT    NOT NULL,
        status       TEXT    NOT NULL,
        progress     REAL    NOT NULL DEFAULT 0,
        size_bytes   INTEGER NOT NULL DEFAULT 0,
        speed_bytes  INTEGER,
        eta_seconds  INTEGER,
        error_msg    TEXT,
        paused       INTEGER NOT NULL DEFAULT 0,
        cached       INTEGER NOT NULL DEFAULT 0,
        seeders      INTEGER,
        peers        INTEGER,
        file_count   INTEGER NOT NULL DEFAULT 0,
        added_at     TEXT    NOT NULL,
        updated_at   TEXT    NOT NULL
      )`
    );

    db = database;
    return database;
  })();

  return initPromise;
}

// ---------------------------------------------------------------------------
// Serialisation helpers
// ---------------------------------------------------------------------------

function downloadToRow(d: CloudDownload): Record<string, unknown> {
  return {
    id: d.id,
    name: d.name,
    type: d.type,
    status: d.status,
    progress: d.progress,
    size_bytes: d.sizeBytes,
    speed_bytes: d.speedBytesPerSec ?? null,
    eta_seconds: d.etaSeconds ?? null,
    error_msg: d.errorMessage ?? null,
    paused: d.paused ? 1 : 0,
    cached: d.cached ? 1 : 0,
    seeders: d.seeders ?? null,
    peers: d.peers ?? null,
    file_count: d.fileCount,
    added_at: d.addedAt.toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToDownload(row: any): CloudDownload {
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as CloudDownload['type'],
    status: row.status as CloudDownload['status'],
    progress: Number(row.progress),
    sizeBytes: Number(row.size_bytes),
    speedBytesPerSec: row.speed_bytes != null ? Number(row.speed_bytes) : undefined,
    etaSeconds: row.eta_seconds != null ? Number(row.eta_seconds) : undefined,
    errorMessage: (row.error_msg as string) ?? undefined,
    paused: Boolean(row.paused),
    cached: Boolean(row.cached),
    seeders: row.seeders != null ? Number(row.seeders) : undefined,
    peers: row.peers != null ? Number(row.peers) : undefined,
    fileCount: Number(row.file_count),
    files: [],
    addedAt: new Date(row.added_at as string),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Read all cached downloads from the local database. */
export async function getCachedDownloads(): Promise<CloudDownload[]> {
  const database = await getDb();
  const rows = await database.select<Record<string, unknown>[]>(
    'SELECT * FROM downloads ORDER BY added_at DESC'
  );
  return rows.map(rowToDownload);
}

/** Persist a batch of downloads, replacing the entire cache. */
export async function saveDownloadsCache(downloads: CloudDownload[]): Promise<void> {
  const database = await getDb();
  await database.execute('DELETE FROM downloads');

  if (downloads.length === 0) {
    return;
  }

  for (const d of downloads) {
    const row = downloadToRow(d);
    await database.execute(
      `INSERT INTO downloads (
        id,name,type,status,progress,size_bytes,speed_bytes,
        eta_seconds,error_msg,paused,cached,seeders,peers,
        file_count,added_at,updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
      )`,
      [
        row.id,
        row.name,
        row.type,
        row.status,
        row.progress,
        row.size_bytes,
        row.speed_bytes,
        row.eta_seconds,
        row.error_msg,
        row.paused,
        row.cached,
        row.seeders,
        row.peers,
        row.file_count,
        row.added_at,
        row.updated_at,
      ]
    );
  }
}

/** Drop and re-create cache (useful for forced refresh). */
export async function clearDownloadsCache(): Promise<void> {
  const database = await getDb();
  await database.execute('DELETE FROM downloads');
}
