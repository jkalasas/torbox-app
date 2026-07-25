use tauri::{
    plugin::{Builder as PluginBuilder, TauriPlugin},
    AppHandle,
};

#[cfg(target_os = "android")]
use serde::{Deserialize, Serialize};
#[cfg(target_os = "android")]
use tauri::Manager;
#[cfg(target_os = "android")]
use tauri::plugin::PluginHandle;

#[cfg(target_os = "android")]
pub struct AndroidBackground(PluginHandle<tauri::Wry>);

#[cfg(target_os = "android")]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BatteryStatus {
    ignoring: bool,
}

#[cfg(target_os = "android")]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NotificationStatus {
    granted: bool,
}

pub fn init() -> TauriPlugin<tauri::Wry> {
    PluginBuilder::<tauri::Wry>::new("background")
        .setup(|app, api| {
            #[cfg(target_os = "android")]
            {
                let handle =
                    api.register_android_plugin("app.torbox.torbox", "BackgroundPlugin")?;
                app.manage(AndroidBackground(handle));
            }
            #[cfg(not(target_os = "android"))]
            {
                let _ = (app, api);
            }
            Ok(())
        })
        .build()
}

#[cfg(target_os = "android")]
fn android_background(app: &AppHandle) -> Result<&AndroidBackground, String> {
    app.try_state::<AndroidBackground>()
        .map(|s| s.inner())
        .ok_or_else(|| "Background plugin unavailable".to_string())
}

#[cfg(target_os = "android")]
async fn start_service(app: &AppHandle) -> Result<(), String> {
    let bg = android_background(app)?;
    bg.0
        .run_mobile_plugin_async::<()>("startService", ())
        .await
        .map_err(|e| e.to_string())
}

#[cfg(target_os = "android")]
async fn stop_service(app: &AppHandle) -> Result<(), String> {
    let bg = android_background(app)?;
    bg.0
        .run_mobile_plugin_async::<()>("stopService", ())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn request_background_permissions(app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        let bg = android_background(&app)?;
        bg.0
            .run_mobile_plugin_async::<()>("requestNotificationPermission", ())
            .await
            .map_err(|e| e.to_string())?;
        bg.0
            .run_mobile_plugin_async::<()>("requestIgnoreBatteryOptimizations", ())
            .await
            .map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Ok(())
    }
}

#[tauri::command]
pub async fn get_background_status(app: AppHandle) -> Result<serde_json::Value, String> {
    #[cfg(target_os = "android")]
    {
        let bg = android_background(&app)?;
        let battery: BatteryStatus = bg
            .0
            .run_mobile_plugin_async("isIgnoringBatteryOptimizations", ())
            .await
            .map_err(|e| e.to_string())?;
        let notification: NotificationStatus = bg
            .0
            .run_mobile_plugin_async("hasNotificationPermission", ())
            .await
            .map_err(|e| e.to_string())?;
        Ok(serde_json::json!({
            "batteryUnrestricted": battery.ignoring,
            "notificationsGranted": notification.granted,
        }))
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Ok(serde_json::json!({
            "batteryUnrestricted": true,
            "notificationsGranted": true,
        }))
    }
}

pub async fn sync_with_active_count(app: &AppHandle, active_count: usize) {
    #[cfg(target_os = "android")]
    {
        if active_count > 0 {
            if let Err(e) = start_service(app).await {
                log::warn!("Failed to start background service: {e}");
            }
        } else if let Err(e) = stop_service(app).await {
            log::warn!("Failed to stop background service: {e}");
        }
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = (app, active_count);
    }
}
