use std::sync::Arc;
use tauri::State;

use crate::download_manager::DownloadManager;
use crate::models::*;

#[tauri::command]
pub async fn start_download(
    args: StartDownloadArgs,
    manager: State<'_, Arc<DownloadManager>>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    manager.start_download(app, args).await
}

#[tauri::command]
pub async fn pause_download(
    download_id: String,
    manager: State<'_, Arc<DownloadManager>>,
) -> Result<(), String> {
    manager.pause_download(&download_id).await
}

#[tauri::command]
pub async fn resume_download(
    download_id: String,
    manager: State<'_, Arc<DownloadManager>>,
) -> Result<(), String> {
    manager.resume_download(&download_id).await
}

#[tauri::command]
pub async fn cancel_download(
    download_id: String,
    manager: State<'_, Arc<DownloadManager>>,
) -> Result<(), String> {
    manager.cancel_download(&download_id).await
}

#[tauri::command]
pub async fn remove_download(
    download_id: String,
    manager: State<'_, Arc<DownloadManager>>,
) -> Result<(), String> {
    manager.remove_download(&download_id).await
}

#[tauri::command]
pub async fn list_downloads(
    manager: State<'_, Arc<DownloadManager>>,
) -> Result<Vec<LocalDownload>, String> {
    manager.list_downloads().await
}

#[tauri::command]
pub async fn get_settings(
    manager: State<'_, Arc<DownloadManager>>,
) -> Result<DownloadSettings, String> {
    manager.load_settings().await
}

#[tauri::command]
pub async fn update_settings(
    settings: DownloadSettings,
    manager: State<'_, Arc<DownloadManager>>,
) -> Result<(), String> {
    manager.save_settings(&settings).await
}
