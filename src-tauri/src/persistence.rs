use rusqlite::{params, Connection};
use std::sync::Mutex;

use crate::models::{ColorMode, DownloadSettings, DownloadStatus, LocalDownload};

pub struct Persistence {
    conn: Mutex<Connection>,
}

impl Persistence {
    pub fn new(db_path: &str) -> Result<Self, rusqlite::Error> {
        let conn = Connection::open(db_path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
        let p = Self {
            conn: Mutex::new(conn),
        };
        p.run_migrations()?;
        Ok(p)
    }

    fn run_migrations(&self) -> Result<(), rusqlite::Error> {
        let conn = self
            .conn
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS downloads (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                size_bytes INTEGER NOT NULL,
                status TEXT NOT NULL,
                destination_path TEXT NOT NULL,
                cloud_download_id TEXT NOT NULL,
                cloud_download_type TEXT,
                file_ids TEXT,
                error_message TEXT,
                total_chunks INTEGER,
                completed_chunks INTEGER,
                added_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                completed_at TEXT
            );

            CREATE TABLE IF NOT EXISTS chunks (
                download_id TEXT NOT NULL REFERENCES downloads(id) ON DELETE CASCADE,
                chunk_index INTEGER NOT NULL,
                offset INTEGER NOT NULL,
                size INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                PRIMARY KEY (download_id, chunk_index)
            );

            CREATE TABLE IF NOT EXISTS download_files (
                download_id TEXT NOT NULL REFERENCES downloads(id) ON DELETE CASCADE,
                file_id INTEGER NOT NULL,
                file_name TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                PRIMARY KEY (download_id, file_id)
            );

            CREATE INDEX IF NOT EXISTS idx_chunks_download_id ON chunks(download_id);
            CREATE INDEX IF NOT EXISTS idx_download_files_download_id ON download_files(download_id);"
        )?;

        // Migration: add file_ids column if missing
        {
            let column_exists: bool = conn
                .query_row(
                    "SELECT COUNT(*) FROM pragma_table_info('downloads') WHERE name='file_ids'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .map(|c| c > 0)
                .unwrap_or(false);

            if !column_exists {
                conn.execute("ALTER TABLE downloads ADD COLUMN file_ids TEXT", [])?;
            }
        }

        // Migration: add cloud_download_type column if missing
        {
            let column_exists: bool = conn.query_row(
                "SELECT COUNT(*) FROM pragma_table_info('downloads') WHERE name='cloud_download_type'",
                [],
                |row| row.get::<_, i64>(0),
            ).map(|c| c > 0).unwrap_or(false);

            if !column_exists {
                conn.execute(
                    "ALTER TABLE downloads ADD COLUMN cloud_download_type TEXT",
                    [],
                )?;
            }
        }

        Ok(())
    }

    // ---- Settings ----

    pub fn get_settings(&self) -> Result<DownloadSettings, rusqlite::Error> {
        let conn = self
            .conn
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let mut stmt = conn.prepare("SELECT key, value FROM settings")?;
        let rows: Vec<(String, String)> = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
            .collect::<Result<Vec<_>, _>>()?;

        let mut settings = DownloadSettings::default();
        for (key, value) in rows {
            match key.as_str() {
                "api_key" => settings.api_key = value,
                "download_dir" => settings.download_dir = value,
                "max_concurrent" => settings.max_concurrent = value.parse().unwrap_or(3),
                "bandwidth_limit" => settings.bandwidth_limit = value.parse().unwrap_or(0),
                "notify_on_complete" => settings.notify_on_complete = value == "true",
                "open_folder_on_complete" => settings.open_folder_on_complete = value == "true",
                "close_to_tray" => settings.close_to_tray = value == "true",
                "color_mode" => {
                    settings.color_mode = match value.as_str() {
                        "auto" => ColorMode::Auto,
                        "light" => ColorMode::Light,
                        _ => ColorMode::Dark,
                    };
                }
                _ => {}
            }
        }
        Ok(settings)
    }

    pub fn save_settings(&self, settings: &DownloadSettings) -> Result<(), rusqlite::Error> {
        let mut conn = self
            .conn
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let tx = conn.transaction()?;
        let pairs = [
            ("api_key", settings.api_key.as_str()),
            ("download_dir", settings.download_dir.as_str()),
            ("max_concurrent", &settings.max_concurrent.to_string()),
            ("bandwidth_limit", &settings.bandwidth_limit.to_string()),
            (
                "notify_on_complete",
                if settings.notify_on_complete {
                    "true"
                } else {
                    "false"
                },
            ),
            (
                "open_folder_on_complete",
                if settings.open_folder_on_complete {
                    "true"
                } else {
                    "false"
                },
            ),
            (
                "close_to_tray",
                if settings.close_to_tray {
                    "true"
                } else {
                    "false"
                },
            ),
            (
                "color_mode",
                match settings.color_mode {
                    ColorMode::Auto => "auto",
                    ColorMode::Dark => "dark",
                    ColorMode::Light => "light",
                },
            ),
        ];
        for (key, value) in pairs {
            tx.execute(
                "INSERT INTO settings (key, value) VALUES (?1, ?2)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                params![key, value],
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    // ---- Downloads ----

    pub fn insert_download(&self, download: &LocalDownload) -> Result<(), rusqlite::Error> {
        let conn = self
            .conn
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let file_ids_str = download.file_ids.as_ref().map(|ids| {
            ids.iter()
                .map(|id| id.to_string())
                .collect::<Vec<_>>()
                .join(",")
        });

        conn.execute(
            "INSERT INTO downloads (id, name, size_bytes, status, destination_path,
             cloud_download_id, cloud_download_type, file_ids, added_at, updated_at, total_chunks, completed_chunks)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9, 0, 0)",
            params![
                download.id,
                download.name,
                download.size_bytes,
                status_to_str(&download.status),
                download.destination_path,
                download.cloud_download_id,
                download.cloud_download_type,
                file_ids_str,
                download.added_at.to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    pub fn update_download_status(
        &self,
        id: &str,
        status: &DownloadStatus,
        error_message: Option<&str>,
    ) -> Result<(), rusqlite::Error> {
        let conn = self
            .conn
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let now = chrono::Utc::now().to_rfc3339();
        let completed_at = if matches!(status, DownloadStatus::Complete) {
            Some(now.clone())
        } else {
            None
        };
        conn.execute(
            "UPDATE downloads SET status=?1, error_message=?2, updated_at=?3, completed_at=?4
             WHERE id=?5",
            params![status_to_str(status), error_message, now, completed_at, id],
        )?;
        Ok(())
    }

    pub fn update_chunk_counts(
        &self,
        id: &str,
        total: u32,
        completed: u32,
    ) -> Result<(), rusqlite::Error> {
        let conn = self
            .conn
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        conn.execute(
            "UPDATE downloads SET total_chunks=?1, completed_chunks=?2, updated_at=?3 WHERE id=?4",
            params![total, completed, chrono::Utc::now().to_rfc3339(), id],
        )?;
        Ok(())
    }

    pub fn list_downloads(&self) -> Result<Vec<LocalDownload>, rusqlite::Error> {
        let conn = self
            .conn
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let mut stmt = conn.prepare(
            "SELECT id, name, size_bytes, status, destination_path, cloud_download_id,
                    error_message, added_at, total_chunks, completed_chunks, cloud_download_type, file_ids
             FROM downloads ORDER BY added_at DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            let status_str: String = row.get(3)?;
            let total_chunks: u32 = row.get(8)?;
            let completed_chunks: u32 = row.get(9)?;
            let progress = if total_chunks > 0 {
                completed_chunks as f64 / total_chunks as f64
            } else {
                0.0
            };
            let file_ids_str: Option<String> = row.get(11)?;
            let file_ids =
                file_ids_str.map(|s| s.split(',').filter_map(|id| id.parse().ok()).collect());
            Ok(LocalDownload {
                id: row.get(0)?,
                name: row.get(1)?,
                size_bytes: row.get::<_, i64>(2)? as u64,
                status: str_to_status(&status_str)?,
                progress,
                speed_bytes_per_sec: None,
                eta_seconds: None,
                error_message: row.get(6)?,
                destination_path: row.get(4)?,
                cloud_download_id: row.get(5)?,
                cloud_download_type: row.get(10)?,
                file_ids,
                added_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(7)?)
                    .map_err(|e| {
                        rusqlite::Error::FromSqlConversionFailure(
                            7,
                            rusqlite::types::Type::Text,
                            Box::new(e),
                        )
                    })?
                    .with_timezone(&chrono::Utc),
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()
    }

    pub fn delete_download(&self, id: &str) -> Result<(), rusqlite::Error> {
        let mut conn = self
            .conn
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let tx = conn.transaction()?;
        tx.execute("DELETE FROM downloads WHERE id=?1", params![id])?;
        tx.commit()?;
        Ok(())
    }

    // ---- Chunks ----

    pub fn init_chunks(
        &self,
        download_id: &str,
        chunks: &[(u32, u64, u64)],
    ) -> Result<(), rusqlite::Error> {
        let mut conn = self
            .conn
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let tx = conn.transaction()?;
        tx.execute(
            "DELETE FROM chunks WHERE download_id=?1",
            params![download_id],
        )?;
        for (index, offset, size) in chunks {
            tx.execute(
                "INSERT INTO chunks (download_id, chunk_index, offset, size, status)
                 VALUES (?1, ?2, ?3, ?4, 'pending')",
                params![download_id, index, offset, size],
            )?;
        }
        tx.execute(
            "UPDATE downloads SET total_chunks=?1, completed_chunks=0, updated_at=?2 WHERE id=?3",
            params![
                chunks.len() as u32,
                chrono::Utc::now().to_rfc3339(),
                download_id
            ],
        )?;
        tx.commit()?;
        Ok(())
    }

    pub fn mark_chunk_complete(
        &self,
        download_id: &str,
        chunk_index: u32,
    ) -> Result<(), rusqlite::Error> {
        let mut conn = self
            .conn
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let tx = conn.transaction()?;
        let rows_changed = tx.execute(
            "UPDATE chunks SET status='complete' WHERE download_id=?1 AND chunk_index=?2 AND status != 'complete'",
            params![download_id, chunk_index],
        )?;
        if rows_changed > 0 {
            tx.execute(
                "UPDATE downloads SET completed_chunks = completed_chunks + 1, updated_at=?1 WHERE id=?2",
                params![chrono::Utc::now().to_rfc3339(), download_id],
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    pub fn get_pending_chunks(
        &self,
        download_id: &str,
    ) -> Result<Vec<(u32, u64, u64)>, rusqlite::Error> {
        let conn = self
            .conn
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let mut stmt = conn.prepare(
            "SELECT chunk_index, offset, size FROM chunks
             WHERE download_id=?1 AND status='pending' ORDER BY chunk_index",
        )?;
        let rows = stmt.query_map(params![download_id], |row| {
            Ok((
                row.get(0)?,
                row.get::<_, i64>(1)? as u64,
                row.get::<_, i64>(2)? as u64,
            ))
        })?;
        rows.collect::<Result<Vec<_>, _>>()
    }

    pub fn get_completed_chunk_count(&self, download_id: &str) -> Result<u32, rusqlite::Error> {
        let conn = self
            .conn
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM chunks WHERE download_id=?1 AND status='complete'",
            params![download_id],
            |row| row.get(0),
        )?;
        Ok(count as u32)
    }

    pub fn clear_chunks(&self, download_id: &str) -> Result<(), rusqlite::Error> {
        let conn = self
            .conn
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        conn.execute(
            "DELETE FROM chunks WHERE download_id=?1",
            params![download_id],
        )?;
        Ok(())
    }

    // ---- Download files ----
}

fn status_to_str(status: &DownloadStatus) -> &'static str {
    match status {
        DownloadStatus::Queued => "queued",
        DownloadStatus::Downloading => "downloading",
        DownloadStatus::Complete => "complete",
        DownloadStatus::Error => "error",
        DownloadStatus::Paused => "paused",
    }
}

fn str_to_status(s: &str) -> Result<DownloadStatus, rusqlite::Error> {
    match s {
        "queued" => Ok(DownloadStatus::Queued),
        "downloading" => Ok(DownloadStatus::Downloading),
        "complete" => Ok(DownloadStatus::Complete),
        "error" => Ok(DownloadStatus::Error),
        "paused" => Ok(DownloadStatus::Paused),
        _ => Err(rusqlite::Error::FromSqlConversionFailure(
            3,
            rusqlite::types::Type::Text,
            Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!("unknown status: {}", s),
            )),
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn temp_db_path() -> String {
        let mut path = PathBuf::from(std::env::temp_dir());
        path.push(format!("torbox_settings_test_{}.db", uuid::Uuid::new_v4()));
        path.to_string_lossy().to_string()
    }

    #[test]
    fn save_and_load_settings_defaults_to_dark_color_mode() {
        let persistence = Persistence::new(&temp_db_path()).unwrap();
        let loaded = persistence.get_settings().unwrap();
        assert_eq!(loaded.color_mode, ColorMode::Dark);
    }

    #[test]
    fn save_and_load_settings_persists_light_color_mode() {
        let persistence = Persistence::new(&temp_db_path()).unwrap();
        let settings = DownloadSettings {
            api_key: "key".to_string(),
            download_dir: "/tmp".to_string(),
            max_concurrent: 5,
            bandwidth_limit: 1000,
            notify_on_complete: false,
            open_folder_on_complete: false,
            close_to_tray: false,
            color_mode: ColorMode::Light,
        };
        persistence.save_settings(&settings).unwrap();
        let loaded = persistence.get_settings().unwrap();
        assert_eq!(loaded, settings);
    }

    #[test]
    fn save_and_load_settings_persists_auto_color_mode() {
        let persistence = Persistence::new(&temp_db_path()).unwrap();
        let settings = DownloadSettings {
            api_key: "key".to_string(),
            download_dir: "/tmp".to_string(),
            max_concurrent: 5,
            bandwidth_limit: 1000,
            notify_on_complete: false,
            open_folder_on_complete: false,
            close_to_tray: true,
            color_mode: ColorMode::Auto,
        };
        persistence.save_settings(&settings).unwrap();
        let loaded = persistence.get_settings().unwrap();
        assert_eq!(loaded, settings);
    }
}
