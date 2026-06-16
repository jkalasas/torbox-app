use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadSettings {
    pub api_key: String,
    pub download_dir: String,
    pub max_concurrent: u32,
    pub bandwidth_limit: u64,
    pub notify_on_complete: bool,
    pub open_folder_on_complete: bool,
}

impl Default for DownloadSettings {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            download_dir: dirs_next_download(),
            max_concurrent: 3,
            bandwidth_limit: 0,
            notify_on_complete: true,
            open_folder_on_complete: true,
        }
    }
}

fn dirs_next_download() -> String {
    dirs_next::download_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("TorBox")
        .to_string_lossy()
        .to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum DownloadStatus {
    Queued,
    Downloading,
    Complete,
    Error,
    Paused,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalDownload {
    pub id: String,
    pub name: String,
    pub status: DownloadStatus,
    pub progress: f64,
    pub size_bytes: u64,
    pub speed_bytes_per_sec: Option<u64>,
    pub eta_seconds: Option<u64>,
    pub error_message: Option<String>,
    pub destination_path: String,
    pub cloud_download_id: String,
    pub cloud_download_type: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_ids: Option<Vec<u64>>,
    #[serde(with = "chrono::serde::ts_milliseconds")]
    pub added_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartDownloadArgs {
    pub cloud_download_id: String,
    pub cloud_download_type: String,
    pub name: String,
    pub size_bytes: u64,
    pub file_ids: Option<Vec<u64>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgressEvent {
    pub download_id: String,
    pub progress: f64,
    pub speed_bytes_per_sec: Option<u64>,
    pub eta_seconds: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadCompleteEvent {
    pub download_id: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadErrorEvent {
    pub download_id: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadQueuedEvent {
    pub download_id: String,
    pub position: usize,
}
