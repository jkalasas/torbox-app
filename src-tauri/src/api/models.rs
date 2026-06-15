use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Standard TorBox API response envelope
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TorBoxResponse<T> {
    pub success: bool,
    pub error: Option<String>,
    pub detail: String,
    pub data: Option<T>,
}

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TorBoxFile {
    pub id: i64,
    #[serde(default)]
    pub md5: Option<String>,
    #[serde(default)]
    pub hash: Option<String>,
    pub name: String,
    pub size: i64,
    #[serde(default)]
    pub zipped: bool,
    #[serde(default)]
    pub s3_path: Option<String>,
    #[serde(default)]
    pub infected: bool,
    #[serde(default)]
    pub mimetype: Option<String>,
    #[serde(default)]
    pub short_name: Option<String>,
    #[serde(default)]
    pub absolute_path: Option<String>,
    #[serde(default)]
    pub opensubtitles_hash: Option<String>,
}

// ---------------------------------------------------------------------------
// Seed preference
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SeedPreference {
    Auto = 1,
    Seed = 2,
    NoSeed = 3,
}

impl SeedPreference {
    pub fn as_i32(self) -> i32 {
        self as i32
    }
}

// ---------------------------------------------------------------------------
// Torrent control operations
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TorrentOperation {
    Reannounce,
    Delete,
    Resume,
    StopSeeding,
}

impl TorrentOperation {
    pub fn as_str(&self) -> &'static str {
        match self {
            TorrentOperation::Reannounce => "reannounce",
            TorrentOperation::Delete => "delete",
            TorrentOperation::Resume => "resume",
            TorrentOperation::StopSeeding => "stop_seeding",
        }
    }
}

// ---------------------------------------------------------------------------
// Web download control operations
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WebDownloadOperation {
    Delete,
}

impl WebDownloadOperation {
    pub fn as_str(&self) -> &'static str {
        match self {
            WebDownloadOperation::Delete => "delete",
        }
    }
}

// ---------------------------------------------------------------------------
// Torrents
// ---------------------------------------------------------------------------

/// Response data for POST /api/torrents/createtorrent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTorrentData {
    #[serde(default)]
    pub hash: Option<String>,
    pub torrent_id: i64,
    #[serde(default)]
    pub auth_id: Option<String>,
}

/// Request body for POST /api/torrents/controltorrent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ControlTorrentRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub torrent_id: Option<i64>,
    pub operation: String,
    #[serde(default)]
    pub all: bool,
}

/// Response data for GET /api/torrents/mylist
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TorrentListData {
    pub id: i64,
    #[serde(default)]
    pub auth_id: Option<String>,
    #[serde(default)]
    pub server: Option<i64>,
    #[serde(default)]
    pub hash: Option<String>,
    pub name: String,
    #[serde(default)]
    pub magnet: Option<String>,
    pub size: i64,
    #[serde(default)]
    pub active: bool,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
    #[serde(default)]
    pub download_state: Option<String>,
    #[serde(default)]
    pub seeds: i64,
    #[serde(default)]
    pub peers: i64,
    #[serde(default)]
    pub ratio: f64,
    #[serde(default)]
    pub progress: f64,
    #[serde(default)]
    pub download_speed: i64,
    #[serde(default)]
    pub upload_speed: i64,
    #[serde(default)]
    pub eta: i64,
    #[serde(default)]
    pub torrent_file: bool,
    #[serde(default)]
    pub expires_at: Option<String>,
    #[serde(default)]
    pub download_present: bool,
    #[serde(default)]
    pub files: Vec<TorBoxFile>,
    #[serde(default)]
    pub download_path: Option<String>,
    #[serde(default)]
    pub availability: f64,
    #[serde(default)]
    pub download_finished: bool,
    #[serde(default)]
    pub tracker: Option<String>,
    #[serde(default)]
    pub total_uploaded: i64,
    #[serde(default)]
    pub total_downloaded: i64,
    #[serde(default)]
    pub cached: bool,
    #[serde(default)]
    pub owner: Option<String>,
    #[serde(default)]
    pub seed_torrent: bool,
    #[serde(default)]
    pub allow_zipped: bool,
    #[serde(default)]
    pub long_term_seeding: bool,
    #[serde(default)]
    pub tracker_message: Option<String>,
    #[serde(default)]
    pub cached_at: Option<String>,
    #[serde(default)]
    pub private: bool,
    #[serde(default)]
    pub alternative_hashes: Vec<String>,
    #[serde(default)]
    pub tags: Vec<String>,
}

// ---------------------------------------------------------------------------
// Web Downloads
// ---------------------------------------------------------------------------

/// Response data for POST /api/webdl/createwebdownload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateWebDownloadData {
    #[serde(default)]
    pub hash: Option<String>,
    pub webdownload_id: i64,
    #[serde(default)]
    pub auth_id: Option<String>,
    #[serde(default)]
    pub jdownloader_id: Option<String>,
    #[serde(default)]
    pub link_list: Vec<String>,
}

/// Request body for POST /api/webdl/controlwebdownload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ControlWebDownloadRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub webdl_id: Option<i64>,
    pub operation: String,
    #[serde(default)]
    pub all: bool,
}

/// Response data for GET /api/webdl/mylist
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebDownloadListData {
    pub id: i64,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
    #[serde(default)]
    pub auth_id: Option<String>,
    pub name: String,
    #[serde(default)]
    pub hash: Option<String>,
    #[serde(default)]
    pub download_state: Option<String>,
    #[serde(default)]
    pub download_speed: i64,
    #[serde(default)]
    pub original_url: Option<String>,
    #[serde(default)]
    pub eta: i64,
    #[serde(default)]
    pub progress: f64,
    pub size: i64,
    #[serde(default)]
    pub download_id: Option<String>,
    #[serde(default)]
    pub files: Vec<TorBoxFile>,
    #[serde(default)]
    pub active: bool,
    #[serde(default)]
    pub cached: bool,
    #[serde(default)]
    pub download_present: bool,
    #[serde(default)]
    pub download_finished: bool,
    #[serde(default)]
    pub expires_at: Option<String>,
    #[serde(default)]
    pub error: Option<String>,
    #[serde(default)]
    pub cached_at: Option<String>,
    #[serde(default)]
    pub server: Option<i64>,
    #[serde(default)]
    pub alternative_hashes: Vec<String>,
    #[serde(default)]
    pub tags: Vec<String>,
}


