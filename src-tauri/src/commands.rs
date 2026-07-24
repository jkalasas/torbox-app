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
    app: tauri::AppHandle,
) -> Result<(), String> {
    manager.pause_download(&app, &download_id).await
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
    delete_local_file: Option<bool>,
    manager: State<'_, Arc<DownloadManager>>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    manager
        .remove_download(&app, &download_id, delete_local_file.unwrap_or(false))
        .await
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
    mut settings: DownloadSettings,
    manager: State<'_, Arc<DownloadManager>>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    normalize_download_dir(&app, &mut settings)?;
    manager.save_settings(&settings).await
}

fn normalize_download_dir(
    app: &tauri::AppHandle,
    settings: &mut DownloadSettings,
) -> Result<(), String> {
    #[cfg(mobile)]
    {
        use tauri::Manager;

        if crate::saf::is_content_uri(&settings.download_dir) {
            return Ok(());
        }

        let mobile_dir = app
            .path()
            .download_dir()
            .map_err(|e| e.to_string())?
            .join("TorBox");
        std::fs::create_dir_all(&mobile_dir).map_err(|e| e.to_string())?;
        let mobile_dir = mobile_dir.to_string_lossy().to_string();

        let keep = !settings.download_dir.is_empty()
            && crate::saf::path_is_under(&settings.download_dir, std::path::Path::new(&mobile_dir));
        if !keep {
            settings.download_dir = mobile_dir;
        }
    }

    #[cfg(not(mobile))]
    {
        let _ = app;
        let _ = settings;
    }

    Ok(())
}
