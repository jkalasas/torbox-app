mod bandwidth_limiter;
mod chunked_downloader;
mod commands;
mod download_manager;
mod models;
mod persistence;
mod queue_manager;

use std::sync::Arc;
use tauri::Manager;

use persistence::Persistence;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init());

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

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

            // Load settings to get initial concurrency/bandwidth
            let settings = persistence.get_settings().unwrap_or_default();

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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
