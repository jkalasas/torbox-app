use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncWriteExt;
use tokio::sync::{watch, Mutex, RwLock};

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
    pub fn new(persistence: Arc<Persistence>, initial_settings: DownloadSettings) -> Arc<Self> {
        let limiter = Arc::new(BandwidthLimiter::new(initial_settings.bandwidth_limit));
        let queue = Arc::new(QueueManager::new(initial_settings.max_concurrent));
        // No total request timeout: large files can take longer than any fixed budget.
        // connect_timeout still bounds hung handshakes; stream errors are retried with resume.
        let client = reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(30))
            .pool_max_idle_per_host(2)
            .pool_idle_timeout(Duration::from_secs(90))
            .tcp_keepalive(Duration::from_secs(30))
            .tcp_nodelay(true)
            .http1_only()
            .redirect(reqwest::redirect::Policy::limited(10))
            .user_agent(concat!("TorBox/", env!("CARGO_PKG_VERSION")))
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
        self.persistence
            .save_settings(settings)
            .map_err(|e| e.to_string())?;
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
            file_ids: args.file_ids.clone(),
            added_at: chrono::Utc::now(),
        };

        self.persistence
            .insert_download(&download)
            .map_err(|e| e.to_string())?;
        let position = self.queue.enqueue(id.clone()).await;

        app.emit(
            "download-queued",
            DownloadQueuedEvent {
                download_id: id.clone(),
                position,
            },
        )
        .ok();

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
                    tauri::async_runtime::spawn(async move {
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

    async fn run_download(
        self: Arc<Self>,
        app: AppHandle,
        download_id: String,
    ) -> Result<(), String> {
        // Create pause channel
        let (pause_tx, pause_rx) = watch::channel(false);
        self.active_downloads
            .lock()
            .await
            .insert(download_id.clone(), pause_tx);

        // Get download info
        let downloads = self.persistence.list_downloads().unwrap_or_default();
        let download = match downloads.iter().find(|d| d.id == download_id) {
            Some(d) => d.clone(),
            None => {
                app.emit(
                    "download-error",
                    DownloadErrorEvent {
                        download_id: download_id.clone(),
                        message: "Download record not found".to_string(),
                    },
                )
                .ok();
                self.persistence
                    .update_download_status(
                        &download_id,
                        &DownloadStatus::Error,
                        Some("Download record not found"),
                    )
                    .ok();
                self.active_downloads.lock().await.remove(&download_id);
                self.queue.deactivate(&download_id).await;
                return Ok(());
            }
        };

        // Update status to downloading
        if let Err(e) = self.persistence.update_download_status(
            &download_id,
            &DownloadStatus::Downloading,
            None,
        ) {
            app.emit(
                "download-error",
                DownloadErrorEvent {
                    download_id: download_id.clone(),
                    message: e.to_string(),
                },
            )
            .ok();
            self.active_downloads.lock().await.remove(&download_id);
            self.queue.deactivate(&download_id).await;
            return Ok(());
        }

        // Get download link from TorBox API
        let settings = self.settings.read().await;
        let api_key = settings.api_key.trim().to_string();
        drop(settings);

        if api_key.is_empty() {
            let message =
                "No API key configured. Open Settings and save a valid TorBox API key.".to_string();
            self.persistence
                .update_download_status(&download_id, &DownloadStatus::Error, Some(&message))
                .ok();
            app.emit(
                "download-error",
                DownloadErrorEvent {
                    download_id: download_id.clone(),
                    message,
                },
            )
            .ok();
            self.active_downloads.lock().await.remove(&download_id);
            self.queue.deactivate(&download_id).await;
            return Ok(());
        }

        let download_url =
            match request_torbox_download_link(&self.client, &api_key, &download).await {
                Ok(url) => url,
                Err(e) => {
                    self.persistence
                        .update_download_status(&download_id, &DownloadStatus::Error, Some(&e))
                        .ok();
                    app.emit(
                        "download-error",
                        DownloadErrorEvent {
                            download_id: download_id.clone(),
                            message: e,
                        },
                    )
                    .ok();
                    self.active_downloads.lock().await.remove(&download_id);
                    self.queue.deactivate(&download_id).await;
                    return Ok(());
                }
            };

        // Open the destination. SAF content:// trees get a real FD so the file appears
        // in the user-selected folder immediately and grows as bytes arrive.
        let open_dest = open_destination(&app, &download.destination_path, &download.name).await;
        let OpenDest {
            file: mut dest_file,
            display_path: final_path_hint,
            saf_publish,
        } = match open_dest {
            Ok(dest) => dest,
            Err(e) => {
                self.persistence
                    .update_download_status(&download_id, &DownloadStatus::Error, Some(&e))
                    .ok();
                app.emit(
                    "download-error",
                    DownloadErrorEvent {
                        download_id: download_id.clone(),
                        message: e,
                    },
                )
                .ok();
                self.active_downloads.lock().await.remove(&download_id);
                self.queue.deactivate(&download_id).await;
                return Ok(());
            }
        };

        // Download via chunked downloader
        let app_for_progress = app.clone();
        let download_id_for_progress = download_id.clone();
        let size_bytes = download.size_bytes;
        // (sample_start, progress_at_sample_start, last_reported_speed)
        let progress_state =
            std::sync::Mutex::new((std::time::Instant::now(), 0.0f64, None::<u64>));
        let result = self
            .chunked
            .download(
                &download_id,
                &download_url,
                &mut dest_file,
                download.size_bytes,
                pause_rx,
                move |progress| {
                    let (speed_bytes_per_sec, eta_seconds) = {
                        let mut state = progress_state.lock().unwrap_or_else(|e| e.into_inner());
                        let (sample_start, start_progress, last_speed) = *state;
                        let now = std::time::Instant::now();
                        let dt = now.duration_since(sample_start).as_secs_f64();

                        // Require a real sample window so tiny packet intervals don't invent GB/s.
                        let speed = if dt >= 0.5 && size_bytes > 0 && progress > start_progress {
                            let bytes_delta =
                                ((progress - start_progress) * size_bytes as f64).max(0.0);
                            let measured = (bytes_delta / dt).round() as u64;
                            *state = (now, progress, Some(measured));
                            Some(measured)
                        } else {
                            last_speed
                        };

                        let eta = match speed {
                            Some(s) if s > 0 && progress < 1.0 => {
                                let remaining =
                                    ((1.0 - progress).max(0.0) * size_bytes as f64).round() as u64;
                                Some(remaining / s)
                            }
                            _ => None,
                        };
                        (speed, eta)
                    };

                    app_for_progress
                        .emit(
                            "download-progress",
                            DownloadProgressEvent {
                                download_id: download_id_for_progress.clone(),
                                progress,
                                speed_bytes_per_sec,
                                eta_seconds,
                            },
                        )
                        .ok();
                },
            )
            .await;

        // Ensure data hits disk / SAF provider before we report completion.
        let _ = dest_file.flush().await;
        drop(dest_file);

        match result {
            Ok(()) => {
                let final_path = if let Some(publish) = saf_publish {
                    match crate::saf::publish_to_saf(
                        &app,
                        &publish.tree_uri,
                        &publish.local_path,
                        &publish.file_name,
                    )
                    .await
                    {
                        Ok(uri) => {
                            let _ = tokio::fs::remove_file(&publish.local_path).await;
                            uri
                        }
                        Err(e) => {
                            log::warn!(
                                "Failed to publish {} to SAF folder: {e}",
                                publish.file_name
                            );
                            publish.local_path
                        }
                    }
                } else {
                    final_path_hint
                };
                self.persistence
                    .update_download_status(&download_id, &DownloadStatus::Complete, None)
                    .ok();
                app.emit(
                    "download-complete",
                    DownloadCompleteEvent {
                        download_id: download_id.clone(),
                        path: final_path,
                    },
                )
                .ok();
            }
            Err(e) if e == "Paused" => {
                self.persistence
                    .update_download_status(&download_id, &DownloadStatus::Paused, None)
                    .ok();
                app.emit(
                    "download-paused",
                    DownloadPausedEvent {
                        download_id: download_id.clone(),
                    },
                )
                .ok();
            }
            Err(e) => {
                self.persistence
                    .update_download_status(&download_id, &DownloadStatus::Error, Some(&e))
                    .ok();
                app.emit(
                    "download-error",
                    DownloadErrorEvent {
                        download_id: download_id.clone(),
                        message: e,
                    },
                )
                .ok();
            }
        }

        self.active_downloads.lock().await.remove(&download_id);
        self.queue.deactivate(&download_id).await;
        Ok(())
    }

    pub async fn pause_download(&self, app: &AppHandle, download_id: &str) -> Result<(), String> {
        if let Some(tx) = self.active_downloads.lock().await.remove(download_id) {
            tx.send(true).ok();
            self.persistence
                .update_download_status(download_id, &DownloadStatus::Paused, None)
                .map_err(|e| e.to_string())?;
            app.emit(
                "download-paused",
                DownloadPausedEvent {
                    download_id: download_id.to_string(),
                },
            )
            .ok();
            return Ok(());
        }

        // Idempotent: already paused (or queued) is not an error.
        let downloads = self
            .persistence
            .list_downloads()
            .map_err(|e| e.to_string())?;
        if let Some(download) = downloads.iter().find(|d| d.id == download_id) {
            if matches!(
                download.status,
                DownloadStatus::Paused | DownloadStatus::Queued
            ) {
                app.emit(
                    "download-paused",
                    DownloadPausedEvent {
                        download_id: download_id.to_string(),
                    },
                )
                .ok();
                return Ok(());
            }
        }

        Err("Download not active".to_string())
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
        let downloads = self
            .persistence
            .list_downloads()
            .map_err(|e| e.to_string())?;
        if let Some(download) = downloads.iter().find(|d| d.id == download_id) {
            if matches!(download.status, DownloadStatus::Complete) {
                return Ok(());
            }
        }
        self.persistence
            .update_download_status(download_id, &DownloadStatus::Queued, None)
            .map_err(|e| e.to_string())?;
        self.queue.enqueue(download_id.to_string()).await;
        Ok(())
    }

    pub async fn cancel_download(&self, download_id: &str) -> Result<(), String> {
        if let Some(tx) = self.active_downloads.lock().await.remove(download_id) {
            tx.send(true).ok();
        }
        self.queue.remove(download_id).await;
        self.persistence
            .update_download_status(download_id, &DownloadStatus::Paused, None)
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn remove_download(&self, download_id: &str) -> Result<(), String> {
        if let Some(tx) = self.active_downloads.lock().await.remove(download_id) {
            tx.send(true).ok();
        }
        self.queue.remove(download_id).await;
        self.persistence
            .delete_download(download_id)
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn list_downloads(&self) -> Result<Vec<LocalDownload>, String> {
        self.persistence.list_downloads().map_err(|e| e.to_string())
    }
}

fn download_type_to_api(type_str: &str) -> Result<(&'static str, &'static str), String> {
    match type_str {
        "torrent" | "torrents" => Ok(("torrents/requestdl", "torrent_id")),
        "web" | "webdl" => Ok(("webdl/requestdl", "web_id")),
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
    let (path, id_key) = download_type_to_api(download_type)?;
    let download_id_num = download
        .cloud_download_id
        .trim_start_matches(|c: char| !c.is_ascii_digit());

    if download_id_num.is_empty() {
        return Err("Invalid cloud download ID".to_string());
    }

    let selected_file_id = download
        .file_ids
        .as_ref()
        .and_then(|ids| ids.first())
        .copied();

    let mut query: Vec<(&str, String)> = vec![
        ("token", api_key.to_string()),
        (id_key, download_id_num.to_string()),
    ];
    if let Some(file_id) = selected_file_id {
        query.push(("file_id", file_id.to_string()));
    } else {
        query.push(("zip_link", "true".to_string()));
    }

    let response = client
        .get(format!("https://api.torbox.app/v1/api/{}", path))
        .query(&query)
        .send()
        .await
        .map_err(|e| format!("API request failed: {}", e))?;

    let status = response.status();
    if status == reqwest::StatusCode::METHOD_NOT_ALLOWED {
        return Err(
            "TorBox API returned 405 Method Not Allowed: requestdl must be a GET request."
                .to_string(),
        );
    }

    let envelope: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("API response parse failed: {}", e))?;

    if !envelope["success"].as_bool().unwrap_or(false) {
        return Err(envelope["detail"]
            .as_str()
            .unwrap_or("Unknown API error")
            .to_string());
    }

    envelope["data"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "No download URL in response".to_string())
}

struct SafPublish {
    tree_uri: String,
    local_path: String,
    file_name: String,
}

struct OpenDest {
    file: tokio::fs::File,
    display_path: String,
    /// When set, bytes were staged locally and must be copied into the SAF tree on success.
    saf_publish: Option<SafPublish>,
}

async fn open_destination(
    app: &AppHandle,
    destination_dir: &str,
    name: &str,
) -> Result<OpenDest, String> {
    if crate::saf::is_content_uri(destination_dir) {
        match crate::saf::open_writable_file(app, destination_dir, name).await {
            Ok(opened) => {
                let file = crate::saf::tokio_file_from_fd(opened.fd)?;
                return Ok(OpenDest {
                    file,
                    display_path: opened.uri,
                    saf_publish: None,
                });
            }
            Err(e) => {
                log::warn!(
                    "Direct SAF write unavailable ({e}); falling back to staging directory"
                );
            }
        }

        let write_dir = crate::saf::staging_dir(app)?;
        let dest_path = open_path_destination(&write_dir.to_string_lossy(), name).await?;
        let local_path = dest_path.display_path.clone();
        return Ok(OpenDest {
            file: dest_path.file,
            display_path: local_path.clone(),
            saf_publish: Some(SafPublish {
                tree_uri: destination_dir.to_string(),
                local_path,
                file_name: name.to_string(),
            }),
        });
    }

    open_path_destination(destination_dir, name).await
}

async fn open_path_destination(base_dir: &str, name: &str) -> Result<OpenDest, String> {
    let dest_dir = std::path::Path::new(base_dir);
    tokio::fs::create_dir_all(&dest_dir)
        .await
        .map_err(|e| format!("Cannot create download directory: {}", e))?;
    let base_dir = tokio::fs::canonicalize(dest_dir)
        .await
        .map_err(|e| format!("Cannot resolve download directory: {}", e))?;
    let dest_path = normalize_within_base(&base_dir, name)?;

    if let Some(parent) = dest_path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Cannot create directory: {}", e))?;
    }

    let file = tokio::fs::OpenOptions::new()
        .create(true)
        .write(true)
        .read(true)
        .truncate(false)
        .open(&dest_path)
        .await
        .map_err(|e| format!("Cannot open {}: {}", dest_path.display(), e))?;

    Ok(OpenDest {
        file,
        display_path: dest_path.to_string_lossy().into_owned(),
        saf_publish: None,
    })
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
                    return Err(
                        "Invalid download path: path escapes destination directory".to_string()
                    );
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
