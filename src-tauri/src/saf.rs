use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::{
    plugin::{Builder as PluginBuilder, TauriPlugin},
    AppHandle, Manager,
};

#[cfg(target_os = "android")]
use tauri::plugin::PluginHandle;

pub fn is_content_uri(value: &str) -> bool {
    value.starts_with("content://")
}

pub fn staging_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .download_dir()
        .map_err(|e| e.to_string())?
        .join("TorBox");
    std::fs::create_dir_all(&dir).map_err(|e| format!("Cannot create staging directory: {e}"))?;
    Ok(dir)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderPick {
    pub uri: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenedSafFile {
    pub uri: String,
    pub fd: i32,
}

#[cfg(target_os = "android")]
#[derive(Debug, Deserialize)]
struct FolderNameResponse {
    name: String,
}

#[cfg(target_os = "android")]
#[derive(Debug, Deserialize)]
struct CopyFileResponse {
    uri: String,
}

#[cfg(target_os = "android")]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OpenWritableFileResponse {
    uri: String,
    fd: i32,
}

#[cfg(target_os = "android")]
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CopyFileArgs<'a> {
    tree_uri: &'a str,
    source_path: &'a str,
    file_name: &'a str,
}

#[cfg(target_os = "android")]
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenWritableFileArgs<'a> {
    tree_uri: &'a str,
    file_name: &'a str,
}

#[cfg(target_os = "android")]
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct FolderNameArgs<'a> {
    tree_uri: &'a str,
}

#[cfg(target_os = "android")]
pub struct AndroidSaf(PluginHandle<tauri::Wry>);

pub fn init() -> TauriPlugin<tauri::Wry> {
    PluginBuilder::<tauri::Wry>::new("saf")
        .setup(|app, api| {
            #[cfg(target_os = "android")]
            {
                let handle = api.register_android_plugin("app.torbox.torbox", "StoragePlugin")?;
                app.manage(AndroidSaf(handle));
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
fn android_saf(app: &AppHandle) -> Result<&AndroidSaf, String> {
    app.try_state::<AndroidSaf>()
        .map(|s| s.inner())
        .ok_or_else(|| "Storage plugin unavailable".to_string())
}

#[tauri::command]
pub async fn pick_download_folder(app: AppHandle) -> Result<FolderPick, String> {
    #[cfg(target_os = "android")]
    {
        let saf = android_saf(&app)?;
        saf.0
            .run_mobile_plugin_async("pickFolder", ())
            .await
            .map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Err("Folder picker via SAF is only available on Android".into())
    }
}

#[tauri::command]
pub async fn get_folder_display_name(app: AppHandle, uri: String) -> Result<String, String> {
    if !is_content_uri(&uri) {
        return Ok(uri);
    }

    #[cfg(target_os = "android")]
    {
        let saf = android_saf(&app)?;
        let response: FolderNameResponse = saf
            .0
            .run_mobile_plugin_async("getFolderName", FolderNameArgs { tree_uri: &uri })
            .await
            .map_err(|e| e.to_string())?;
        Ok(response.name)
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Ok(uri)
    }
}

pub async fn open_writable_file(
    app: &AppHandle,
    tree_uri: &str,
    file_name: &str,
) -> Result<OpenedSafFile, String> {
    #[cfg(target_os = "android")]
    {
        let saf = android_saf(app)?;
        let response: OpenWritableFileResponse = saf
            .0
            .run_mobile_plugin_async(
                "openWritableFile",
                OpenWritableFileArgs {
                    tree_uri,
                    file_name,
                },
            )
            .await
            .map_err(|e| e.to_string())?;
        if response.fd < 0 {
            return Err("Invalid file descriptor from storage plugin".into());
        }
        Ok(OpenedSafFile {
            uri: response.uri,
            fd: response.fd,
        })
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = (app, tree_uri, file_name);
        Err("Direct SAF writes are only available on Android".into())
    }
}

pub fn tokio_file_from_fd(fd: i32) -> Result<tokio::fs::File, String> {
    #[cfg(any(target_os = "android", unix))]
    {
        use std::os::fd::{FromRawFd, OwnedFd};
        if fd < 0 {
            return Err("Invalid file descriptor".into());
        }
        // SAFETY: FD ownership was transferred from the Android plugin via detachFd().
        let owned = unsafe { OwnedFd::from_raw_fd(fd) };
        let std_file = std::fs::File::from(owned);
        Ok(tokio::fs::File::from_std(std_file))
    }
    #[cfg(not(any(target_os = "android", unix)))]
    {
        let _ = fd;
        Err("File-descriptor destinations are not supported on this platform".into())
    }
}

pub async fn publish_to_saf(
    app: &AppHandle,
    tree_uri: &str,
    source_path: &str,
    file_name: &str,
) -> Result<String, String> {
    #[cfg(target_os = "android")]
    {
        let saf = android_saf(app)?;
        let response: CopyFileResponse = saf
            .0
            .run_mobile_plugin_async(
                "copyFile",
                CopyFileArgs {
                    tree_uri,
                    source_path,
                    file_name,
                },
            )
            .await
            .map_err(|e| e.to_string())?;
        Ok(response.uri)
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = (app, tree_uri, source_path, file_name);
        Err("SAF publish is only available on Android".into())
    }
}

#[cfg_attr(not(mobile), allow(dead_code))]
pub fn path_is_under(path: &str, base: &Path) -> bool {
    Path::new(path).starts_with(base)
}
