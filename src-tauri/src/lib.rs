mod bandwidth_limiter;
mod chunked_downloader;
mod commands;
mod download_manager;
mod models;
mod persistence;
mod queue_manager;
mod saf;

use std::sync::Arc;
use tauri::Manager;

use models::DownloadSettings;
use persistence::Persistence;

#[cfg(mobile)]
fn resolve_settings(app: &tauri::App, persistence: &Persistence) -> DownloadSettings {
    let mut settings = persistence.get_settings().unwrap_or_default();

    // Always ensure a writable staging/app directory exists.
    let app_download = app
        .path()
        .download_dir()
        .ok()
        .map(|dir| dir.join("TorBox"));

    if let Some(ref mobile_dir) = app_download {
        std::fs::create_dir_all(mobile_dir).ok();
    }

    // Keep user-selected SAF tree URIs. Otherwise force app-scoped storage
    // (dirs-next is meaningless on mobile; public paths need special access).
    if saf::is_content_uri(&settings.download_dir) {
        return settings;
    }

    if let Some(mobile_dir) = app_download {
        let mobile_dir = mobile_dir.to_string_lossy().to_string();
        let keep = !settings.download_dir.is_empty()
            && saf::path_is_under(&settings.download_dir, std::path::Path::new(&mobile_dir));
        if !keep && settings.download_dir != mobile_dir {
            settings.download_dir = mobile_dir;
            persistence.save_settings(&settings).ok();
        }
    }

    settings
}

#[cfg(not(mobile))]
fn resolve_settings(_app: &tauri::App, persistence: &Persistence) -> DownloadSettings {
    persistence.get_settings().unwrap_or_default()
}

fn install_crypto_provider() {
    // reqwest 0.13 (pulled by Tauri / plugins) can build with rustls-no-provider and
    // panics on Android unless a process-wide CryptoProvider is installed first.
    let _ = rustls::crypto::ring::default_provider().install_default();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    install_crypto_provider();

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .plugin(saf::init());

    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    builder
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Custom chrome on Windows/Linux; macOS keeps overlay + native traffic lights.
            #[cfg(any(target_os = "windows", target_os = "linux"))]
            {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_decorations(false);
                }
            }

            // Initialize SQLite for downloads
            let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
            std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
            let db_path = app_dir.join("downloads.db");
            let db_path_str = db_path.to_str().ok_or("Invalid database path")?;
            let persistence = Arc::new(Persistence::new(db_path_str).map_err(|e| e.to_string())?);

            // Migrate API key from Tauri Store to SQLite on first run
            {
                let store_path = app_dir.join("settings.json");
                if store_path.exists() {
                    if let Ok(contents) = std::fs::read_to_string(&store_path) {
                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&contents) {
                            if let Some(key) = json["api_key"].as_str() {
                                let settings = persistence.get_settings().unwrap_or_default();
                                if settings.api_key.is_empty() && !key.is_empty() {
                                    let mut s = settings;
                                    s.api_key = key.to_string();
                                    persistence.save_settings(&s).ok();
                                }
                            }
                        }
                    }
                }
            }

            let settings = resolve_settings(app, &persistence);
            let manager = crate::download_manager::DownloadManager::new(persistence, settings);

            // Spawn queue processor on the Tauri-managed runtime
            let app_handle = app.handle().clone();
            let mgr = manager.clone();
            tauri::async_runtime::spawn(async move {
                mgr.process_queue(app_handle).await;
            });

            app.manage(manager);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::start_download,
            commands::pause_download,
            commands::resume_download,
            commands::cancel_download,
            commands::remove_download,
            commands::list_downloads,
            commands::get_settings,
            commands::update_settings,
            saf::pick_download_folder,
            saf::get_folder_display_name,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
