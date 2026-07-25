use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use tauri::{
    menu::{MenuBuilder, MenuEvent},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, AppHandle, Manager, WindowEvent,
};

use crate::download_manager::DownloadManager;

pub struct TrayState {
    pub is_quitting: AtomicBool,
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn close_to_tray_enabled(app: &AppHandle) -> bool {
    app.try_state::<Arc<DownloadManager>>()
        .and_then(|manager| manager.persistence.get_settings().ok())
        .map(|settings| settings.close_to_tray)
        .unwrap_or(true)
}

fn quit_app(app: &AppHandle) {
    if let Some(state) = app.try_state::<TrayState>() {
        state.is_quitting.store(true, Ordering::SeqCst);
    }
    app.exit(0);
}

pub fn setup(app: &App) -> tauri::Result<()> {
    app.manage(TrayState {
        is_quitting: AtomicBool::new(false),
    });

    let menu = MenuBuilder::new(app)
        .text("show", "Show TorBox")
        .separator()
        .text("quit", "Quit")
        .build()?;

    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or_else(|| tauri::Error::InvalidIcon(std::io::Error::other("missing default window icon")))?;

    let _tray = TrayIconBuilder::with_id("main")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("TorBox")
        .icon(icon)
        .on_menu_event(|app, event: MenuEvent| match event.id.as_ref() {
            "show" => show_main_window(app),
            "quit" => quit_app(app),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            match event {
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                }
                | TrayIconEvent::DoubleClick {
                    button: MouseButton::Left,
                    ..
                } => {
                    show_main_window(tray.app_handle());
                }
                _ => {}
            }
        })
        .build(app)?;

    let handle = app.handle().clone();
    if let Some(window) = app.get_webview_window("main") {
        window.on_window_event(move |event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let quitting = handle
                    .try_state::<TrayState>()
                    .map(|state| state.is_quitting.load(Ordering::SeqCst))
                    .unwrap_or(false);

                if quitting {
                    return;
                }

                if close_to_tray_enabled(&handle) {
                    api.prevent_close();
                    if let Some(window) = handle.get_webview_window("main") {
                        let _ = window.hide();
                    }
                }
            }
        });
    }

    Ok(())
}
