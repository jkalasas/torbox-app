use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{Mutex, RwLock, watch};
use tauri::{AppHandle, Emitter};

use crate::bandwidth_limiter::BandwidthLimiter;
use crate::chunked_downloader::ChunkedDownloader;
use crate::models::*;
use crate::persistence::Persistence;
use crate::queue_manager::QueueManager;

pub struct DownloadManager {
    pub persistence: Arc<Persistence>,
    pub limiter: Arc<BandwidthLimiter>,
    pub queue: Arc<QueueManager>,
    pub chunked: Arc<ChunkedDownloader>,
    pub client: reqwest::Client,
    active_downloads: Arc<Mutex<HashMap<String, watch::Sender<bool>>>>,
    settings: Arc<RwLock<DownloadSettings>>,
}

impl DownloadManager {
    pub fn new(
        persistence: Arc<Persistence>,
        initial_settings: DownloadSettings,
    ) -> Arc<Self> {
        let limiter = Arc::new(BandwidthLimiter::new(initial_settings.bandwidth_limit));
        let queue = Arc::new(QueueManager::new(initial_settings.max_concurrent));
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(300))
            .build()
            .expect("Failed to build HTTP client");
        let chunked = Arc::new(ChunkedDownloader::new(
            persistence.clone(),
            limiter.clone(),
            client.clone(),
        ));

        Arc::new(Self {
            persistence,
            limiter,
            queue,
            chunked,
            active_downloads: Arc::new(Mutex::new(HashMap::new())),
            settings: Arc::new(RwLock::new(initial_settings)),
            client,
        })
    }

    pub async fn load_settings(&self) -> Result<DownloadSettings, String> {
        let settings = self.persistence.get_settings().map_err(|e| e.to_string())?;
        *self.settings.write().await = settings.clone();
        self.limiter.set_rate(settings.bandwidth_limit).await;
        Ok(settings)
    }

    pub async fn save_settings(&self, settings: &DownloadSettings) -> Result<(), String> {
        self.persistence.save_settings(settings).map_err(|e| e.to_string())?;
        *self.settings.write().await = settings.clone();
        self.limiter.set_rate(settings.bandwidth_limit).await;
        self.queue.set_max_concurrent(settings.max_concurrent).await;
        Ok(())
    }

    pub async fn start_download(
        self: &Arc<Self>,
        app: AppHandle,
        args: StartDownloadArgs,
    ) -> Result<String, String> {
        if args.name.is_empty() {
            return Err("Download name cannot be empty".to_string());
        }

        let settings = self.settings.read().await;
        let id = uuid::Uuid::new_v4().to_string();

        let download = LocalDownload {
            id: id.clone(),
            name: args.name,
            status: DownloadStatus::Queued,
            progress: 0.0,
            size_bytes: args.size_bytes,
            speed_bytes_per_sec: None,
            eta_seconds: None,
            error_message: None,
            destination_path: settings.download_dir.clone(),
            cloud_download_id: args.cloud_download_id.clone(),
            cloud_download_type: Some(args.cloud_download_type.clone()),
            added_at: chrono::Utc::now(),
        };

        self.persistence.insert_download(&download).map_err(|e| e.to_string())?;
        let position = self.queue.enqueue(id.clone()).await;

        app.emit("download-queued", DownloadQueuedEvent {
            download_id: id.clone(),
            position,
        }).ok();

        Ok(id)
    }

    pub async fn process_queue(self: Arc<Self>, app: AppHandle) {
        loop {
            self.queue.wait_for_change().await;
            loop {
                let permit = match self.queue.acquire_slot().await {
                    Ok(p) => p,
                    Err(_) => break,
                };
                let id = self.queue.pop().await;
                if let Some(id) = id {
                    self.queue.activate(id.clone()).await;
                    let manager = self.clone();
                    let app = app.clone();
                    tokio::spawn(async move {
                        let _permit = permit;
                        let _ = manager.run_download(app, id).await;
                    });
                } else {
                    drop(permit);
                    break;
                }
            }
        }
    }

    async fn prepare_dest_path(
        &self,
        base_dir: &str,
        name: &str,
    ) -> Result<(std::path::PathBuf, std::path::PathBuf), String> {
        let dest_dir = std::path::Path::new(base_dir);
        tokio::fs::create_dir_all(&dest_dir)
            .await
            .map_err(|e| format!("Cannot create download directory: {}", e))?;
        let base_dir = tokio::fs::canonicalize(dest_dir)
            .await
            .map_err(|e| format!("Cannot resolve download directory: {}", e))?;
        let dest_path = normalize_within_base(&base_dir, name)?;
        Ok((base_dir, dest_path))
    }

    async fn run_download(self: Arc<Self>, app: AppHandle, download_id: String) -> Result<(), String> {
        // Create pause channel
        let (pause_tx, pause_rx) = watch::channel(false);
        self.active_downloads.lock().await.insert(download_id.clone(), pause_tx);

        // Get download info
        let downloads = self.persistence.list_downloads().unwrap_or_default();
        let download = match downloads.iter().find(|d| d.id == download_id) {
            Some(d) => d.clone(),
            None => {
                app.emit("download-error", DownloadErrorEvent {
                    download_id: download_id.clone(),
                    message: "Download record not found".to_string(),
                }).ok();
                self.persistence.update_download_status(&download_id, &DownloadStatus::Error, Some("Download record not found")).ok();
                self.active_downloads.lock().await.remove(&download_id);
                self.queue.deactivate(&download_id).await;
                return Ok(());
            }
        };

        // Update status to downloading
        if let Err(e) = self.persistence.update_download_status(&download_id, &DownloadStatus::Downloading, None) {
            app.emit("download-error", DownloadErrorEvent {
                download_id: download_id.clone(),
                message: e.to_string(),
            }).ok();
            self.active_downloads.lock().await.remove(&download_id);
            self.queue.deactivate(&download_id).await;
            return Ok(());
        }

        // Get download link from TorBox API
        let settings = self.settings.read().await;
        let api_key = settings.api_key.clone();
        drop(settings);

        let download_url = match request_torbox_download_link(&self.client, &api_key, &download).await {
            Ok(url) => url,
            Err(e) => {
                self.persistence.update_download_status(
                    &download_id, &DownloadStatus::Error, Some(&e),
                ).ok();
                app.emit("download-error", DownloadErrorEvent {
                    download_id: download_id.clone(),
                    message: e,
                }).ok();
                self.active_downloads.lock().await.remove(&download_id);
                self.queue.deactivate(&download_id).await;
                return Ok(());
            }
        };

        // Create destination directory and validate final path
        let dest_path = match self.prepare_dest_path(&download.destination_path, &download.name).await {
            Ok((_, dest)) => dest,
            Err(e) => {
                self.persistence.update_download_status(&download_id, &DownloadStatus::Error, Some(&e)).ok();
                app.emit("download-error", DownloadErrorEvent {
                    download_id: download_id.clone(),
                    message: e,
                }).ok();
                self.active_downloads.lock().await.remove(&download_id);
                self.queue.deactivate(&download_id).await;
                return Ok(());
            }
        };
        let dest_path = dest_path.to_string_lossy().to_string();

        // Download via chunked downloader
        let app_for_progress = app.clone();
        let download_id_for_progress = download_id.clone();
        let result = self.chunked.download(
            &download_id, &download_url, &dest_path,
            download.size_bytes, pause_rx,
            move |progress| {
                app_for_progress.emit("download-progress", DownloadProgressEvent {
                    download_id: download_id_for_progress.clone(),
                    progress,
                    speed_bytes_per_sec: None,
                    eta_seconds: None,
                }).ok();
            },
        ).await;

        match result {
            Ok(()) => {
                self.persistence.update_download_status(
                    &download_id, &DownloadStatus::Complete, None,
                ).ok();
                app.emit("download-complete", DownloadCompleteEvent {
                    download_id: download_id.clone(),
                    path: dest_path,
                }).ok();
            }
            Err(e) if e == "Paused" => {
                self.persistence.update_download_status(
                    &download_id, &DownloadStatus::Paused, None,
                ).ok();
            }
            Err(e) => {
                self.persistence.update_download_status(
                    &download_id, &DownloadStatus::Error, Some(&e),
                ).ok();
                app.emit("download-error", DownloadErrorEvent {
                    download_id: download_id.clone(),
                    message: e,
                }).ok();
            }
        }

        self.active_downloads.lock().await.remove(&download_id);
        self.queue.deactivate(&download_id).await;
        Ok(())
    }

    pub async fn pause_download(&self, download_id: &str) -> Result<(), String> {
        if let Some(tx) = self.active_downloads.lock().await.remove(download_id) {
            tx.send(true).ok();
            self.persistence.update_download_status(download_id, &DownloadStatus::Paused, None)
                .map_err(|e| e.to_string())?;
            Ok(())
        } else {
            Err("Download not active".to_string())
        }
    }

    pub async fn resume_download(&self, download_id: &str) -> Result<(), String> {
        // Do not resume if currently active
        if self.active_downloads.lock().await.contains_key(download_id) {
            return Ok(());
        }
        // Do not resume if already queued
        if self.queue.queue_position(download_id).await.is_some() {
            return Ok(());
        }
        // Do not resume if already complete
        let downloads = self.persistence.list_downloads().map_err(|e| e.to_string())?;
        if let Some(download) = downloads.iter().find(|d| d.id == download_id) {
            if matches!(download.status, DownloadStatus::Complete) {
                return Ok(());
            }
        }
        self.persistence.update_download_status(download_id, &DownloadStatus::Queued, None)
            .map_err(|e| e.to_string())?;
        self.queue.enqueue(download_id.to_string()).await;
        Ok(())
    }

    pub async fn cancel_download(&self, download_id: &str) -> Result<(), String> {
        if let Some(tx) = self.active_downloads.lock().await.remove(download_id) {
            tx.send(true).ok();
        }
        self.queue.remove(download_id).await;
        self.persistence.update_download_status(download_id, &DownloadStatus::Paused, None)
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn remove_download(&self, download_id: &str) -> Result<(), String> {
        if let Some(tx) = self.active_downloads.lock().await.remove(download_id) {
            tx.send(true).ok();
        }
        self.queue.remove(download_id).await;
        self.persistence.delete_download(download_id).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn list_downloads(&self) -> Result<Vec<LocalDownload>, String> {
        self.persistence.list_downloads().map_err(|e| e.to_string())
    }
}

fn download_type_to_api(type_str: &str) -> Result<(&'static str, &'static str), String> {
    match type_str {
        "torrent" | "torrents" => Ok(("torrents/requestdl", "torrent_id")),
        "web" | "webdl" => Ok(("webdl/requestdl", "webdl_id")),
        "usenet" => Ok(("usenet/requestdl", "usenet_id")),
        _ => Err(format!("Unsupported cloud download type: {}", type_str)),
    }
}

async fn request_torbox_download_link(
    client: &reqwest::Client,
    api_key: &str,
    download: &LocalDownload,
) -> Result<String, String> {
    let download_type = download.cloud_download_type.as_deref().unwrap_or("torrent");
    let (path, body_key) = download_type_to_api(download_type)?;
    let download_id_num = &download.cloud_download_id;

    // TODO: per-file downloads need to wire the selected file_id separately.
    let response = client
        .post(format!("https://api.torbox.app/v1/api/{}", path))
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&serde_json::json!({ body_key: download_id_num, "file_id": 0 }))
        .send()
        .await
        .map_err(|e| format!("API request failed: {}", e))?;

    let envelope: serde_json::Value = response.json().await
        .map_err(|e| format!("API response parse failed: {}", e))?;

    if !envelope["success"].as_bool().unwrap_or(false) {
        return Err(envelope["detail"].as_str().unwrap_or("Unknown API error").to_string());
    }

    envelope["data"].as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "No download URL in response".to_string())
}

fn normalize_within_base(base: &std::path::Path, name: &str) -> Result<std::path::PathBuf, String> {
    let name_path = std::path::Path::new(name);
    if name_path.is_absolute() {
        return Err("Download name must be relative".to_string());
    }

    let mut depth: usize = 0;
    for component in name_path.components() {
        match component {
            std::path::Component::Prefix(_) => {
                return Err("Invalid path prefix".to_string());
            }
            std::path::Component::RootDir | std::path::Component::CurDir => {}
            std::path::Component::ParentDir => {
                if depth == 0 {
                    return Err("Invalid download path: path escapes destination directory".to_string());
                }
                depth -= 1;
            }
            std::path::Component::Normal(_) => depth += 1,
        }
    }

    Ok(base.join(name_path))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn normalize_within_base_accepts_simple_name() {
        let base = Path::new("/tmp");
        assert_eq!(
            normalize_within_base(base, "file.txt").unwrap(),
            Path::new("/tmp/file.txt")
        );
    }

    #[test]
    fn normalize_within_base_accepts_subdirectory() {
        let base = Path::new("/tmp");
        assert_eq!(
            normalize_within_base(base, "dir/file.txt").unwrap(),
            Path::new("/tmp/dir/file.txt")
        );
    }

    #[test]
    fn normalize_within_base_rejects_traversal() {
        let base = Path::new("/tmp");
        assert!(normalize_within_base(base, "../file.txt").is_err());
        assert!(normalize_within_base(base, "dir/../../file.txt").is_err());
    }

    #[test]
    fn normalize_within_base_rejects_absolute_name() {
        let base = Path::new("/tmp");
        assert!(normalize_within_base(base, "/etc/passwd").is_err());
    }
}
