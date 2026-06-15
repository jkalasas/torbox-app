mod api;

use api::client::TorBoxClient;
use api::models::*;
use api::error::TorBoxError;

// ---------------------------------------------------------------------------
// Torrents commands
// ---------------------------------------------------------------------------

#[tauri::command]
async fn create_torrent_magnet(
    api_key: String,
    magnet: String,
    seed: Option<i32>,
    allow_zip: Option<bool>,
    name: Option<String>,
    as_queued: Option<bool>,
    add_only_if_cached: Option<bool>,
) -> Result<CreateTorrentData, TorBoxError> {
    let seed_pref = seed.map(|s| match s {
        2 => SeedPreference::Seed,
        3 => SeedPreference::NoSeed,
        _ => SeedPreference::Auto,
    });
    let client = TorBoxClient::new(api_key);
    client
        .create_torrent_magnet(
            &magnet,
            seed_pref,
            allow_zip,
            name.as_deref(),
            as_queued,
            add_only_if_cached,
        )
        .await
}

#[tauri::command]
async fn create_torrent_file(
    api_key: String,
    file_data: Vec<u8>,
    file_name: String,
    seed: Option<i32>,
    allow_zip: Option<bool>,
    name: Option<String>,
    as_queued: Option<bool>,
    add_only_if_cached: Option<bool>,
) -> Result<CreateTorrentData, TorBoxError> {
    let seed_pref = seed.map(|s| match s {
        2 => SeedPreference::Seed,
        3 => SeedPreference::NoSeed,
        _ => SeedPreference::Auto,
    });
    let client = TorBoxClient::new(api_key);
    client
        .create_torrent_file(
            file_data,
            &file_name,
            seed_pref,
            allow_zip,
            name.as_deref(),
            as_queued,
            add_only_if_cached,
        )
        .await
}

#[tauri::command]
async fn create_torrent_async_magnet(
    api_key: String,
    magnet: String,
    seed: Option<i32>,
    allow_zip: Option<bool>,
    name: Option<String>,
    as_queued: Option<bool>,
    add_only_if_cached: Option<bool>,
) -> Result<(), TorBoxError> {
    let seed_pref = seed.map(|s| match s {
        2 => SeedPreference::Seed,
        3 => SeedPreference::NoSeed,
        _ => SeedPreference::Auto,
    });
    let client = TorBoxClient::new(api_key);
    client
        .create_torrent_async_magnet(
            &magnet,
            seed_pref,
            allow_zip,
            name.as_deref(),
            as_queued,
            add_only_if_cached,
        )
        .await
}

#[tauri::command]
async fn control_torrent(
    api_key: String,
    torrent_id: Option<i64>,
    operation: String,
    all: Option<bool>,
) -> Result<(), TorBoxError> {
    let op = match operation.as_str() {
        "reannounce" => TorrentOperation::Reannounce,
        "delete" => TorrentOperation::Delete,
        "resume" => TorrentOperation::Resume,
        "stop_seeding" => TorrentOperation::StopSeeding,
        other => {
            return Err(TorBoxError::UnexpectedResponse(format!(
                "Invalid operation: {}. Valid operations: reannounce, delete, resume, stop_seeding",
                other
            )))
        }
    };
    let client = TorBoxClient::new(api_key);
    client.control_torrent(torrent_id, op, all).await
}

#[tauri::command]
async fn get_torrent_list(
    api_key: String,
    bypass_cache: Option<bool>,
    id: Option<i64>,
    offset: Option<i64>,
    limit: Option<i64>,
) -> Result<Vec<TorrentListData>, TorBoxError> {
    let client = TorBoxClient::new(api_key);
    client.get_torrent_list(bypass_cache, id, offset, limit).await
}

#[tauri::command]
async fn request_torrent_download_link(
    api_key: String,
    torrent_id: i64,
    file_id: Option<i64>,
    zip_link: Option<bool>,
    user_ip: Option<String>,
    redirect: Option<bool>,
    append_name: Option<bool>,
) -> Result<String, TorBoxError> {
    let client = TorBoxClient::new(api_key);
    client
        .request_torrent_download_link(
            torrent_id,
            file_id,
            zip_link,
            user_ip.as_deref(),
            redirect,
            append_name,
        )
        .await
}

// ---------------------------------------------------------------------------
// Web Download commands
// ---------------------------------------------------------------------------

#[tauri::command]
async fn create_web_download(
    api_key: String,
    link: String,
    password: Option<String>,
    name: Option<String>,
    as_queued: Option<bool>,
    add_only_if_cached: Option<bool>,
) -> Result<CreateWebDownloadData, TorBoxError> {
    let client = TorBoxClient::new(api_key);
    client
        .create_web_download(
            &link,
            password.as_deref(),
            name.as_deref(),
            as_queued,
            add_only_if_cached,
        )
        .await
}

#[tauri::command]
async fn control_web_download(
    api_key: String,
    webdl_id: Option<i64>,
    operation: String,
    all: Option<bool>,
) -> Result<(), TorBoxError> {
    let op = match operation.as_str() {
        "delete" => WebDownloadOperation::Delete,
        other => {
            return Err(TorBoxError::UnexpectedResponse(format!(
                "Invalid operation: {}. Valid operation: delete",
                other
            )))
        }
    };
    let client = TorBoxClient::new(api_key);
    client.control_web_download(webdl_id, op, all).await
}

#[tauri::command]
async fn get_web_download_list(
    api_key: String,
    bypass_cache: Option<bool>,
    id: Option<i64>,
    offset: Option<i64>,
    limit: Option<i64>,
) -> Result<Vec<WebDownloadListData>, TorBoxError> {
    let client = TorBoxClient::new(api_key);
    client
        .get_web_download_list(bypass_cache, id, offset, limit)
        .await
}

#[tauri::command]
async fn request_web_download_link(
    api_key: String,
    web_id: i64,
    file_id: Option<i64>,
    zip_link: Option<bool>,
    user_ip: Option<String>,
    redirect: Option<bool>,
    append_name: Option<bool>,
) -> Result<String, TorBoxError> {
    let client = TorBoxClient::new(api_key);
    client
        .request_web_download_link(
            web_id,
            file_id,
            zip_link,
            user_ip.as_deref(),
            redirect,
            append_name,
        )
        .await
}

#[tauri::command]
async fn check_cached_web_downloads(
    api_key: String,
    hashes: Vec<String>,
    format: Option<String>,
    list_files: Option<bool>,
) -> Result<serde_json::Value, TorBoxError> {
    let client = TorBoxClient::new(api_key);
    client
        .check_cached_web_downloads(&hashes, format.as_deref(), list_files)
        .await
}

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Torrents
            create_torrent_magnet,
            create_torrent_file,
            create_torrent_async_magnet,
            control_torrent,
            get_torrent_list,
            request_torrent_download_link,
            // Web Downloads
            create_web_download,
            control_web_download,
            get_web_download_list,
            request_web_download_link,
            check_cached_web_downloads,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
