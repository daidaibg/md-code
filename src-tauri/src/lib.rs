mod application_data;
mod commands;
mod file_watcher;
mod startup_files;

use application_data::schedule_webview_cache_cleanup;
use commands::filesystem::{
    open_directory, read_text_file, rename_text_file, reveal_in_file_manager, write_binary_file,
    write_text_file,
};
use commands::notes::{delete_note, load_notes, resolve_notes_directory, save_note};
use commands::system_proxy::system_http_proxy;
use file_watcher::{sync_file_watcher, FileWatcherState};
use startup_files::{initial_open_paths, paths_from_args};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WebviewUrl, WebviewWindowBuilder,
};

const OPEN_FILES_EVENT: &str = "md-code://open-files";
const OPEN_NOTES_EVENT: &str = "md-code://open-notes";
const OPEN_SETTINGS_EVENT: &str = "md-code://open-settings";
const REQUEST_EXIT_EVENT: &str = "md-code://request-exit";

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn open_main_page(app: &tauri::AppHandle, event: &str) {
    show_main_window(app);
    if let Err(error) = app.emit_to("main", event, ()) {
        log::error!("打开主窗口页面失败：{error}");
    }
}

#[tauri::command]
fn exit_application(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
async fn open_notes_window(app: tauri::AppHandle) -> Result<(), String> {
    // WebView2 window creation must run outside a synchronous IPC handler on Windows.
    // Otherwise the UI thread can deadlock, blocking both notes and the main window.
    if let Some(window) = app.get_webview_window("notes") {
        window.unminimize().map_err(|error| error.to_string())?;
        window.show().map_err(|error| error.to_string())?;
        window.set_focus().map_err(|error| error.to_string())?;
        return Ok(());
    }

    WebviewWindowBuilder::new(
        &app,
        "notes",
        WebviewUrl::App("index.html".into()),
    )
    .initialization_script("window.__MD_CODE_NOTES_WINDOW__ = true;")
    .title("MD Code 便签")
    .inner_size(760.0, 620.0)
    .min_inner_size(720.0, 480.0)
    .center()
    .build()
    .map(|_| ())
    .map_err(|error| error.to_string())
}

#[tauri::command]
fn open_main_settings(app: tauri::AppHandle) {
    open_main_page(&app, OPEN_SETTINGS_EVENT);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let application_data = application_data::prepare();
    #[cfg(windows)]
    std::env::set_var(
        "WEBVIEW2_USER_DATA_FOLDER",
        &application_data.webview_environment_root,
    );
    let log_directory = application_data.root.join("logs");
    let application_data_state = application_data.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            let paths = paths_from_args(args, Some(&cwd));
            if !paths.is_empty() {
                let _ = app.emit(OPEN_FILES_EVENT, paths);
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .setup(move |app| {
            app.manage(application_data_state.clone());
            app.manage(FileWatcherState::new(app.handle().clone())?);
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .clear_targets()
                        .target(tauri_plugin_log::Target::new(
                            tauri_plugin_log::TargetKind::Stdout,
                        ))
                        .target(tauri_plugin_log::Target::new(
                            tauri_plugin_log::TargetKind::Folder {
                                path: log_directory.clone(),
                                file_name: None,
                            },
                        ))
                        .build(),
                )?;
            }
            let show_item = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
            let notes_item = MenuItem::with_id(app, "notes", "便签", true, None::<&str>)?;
            let settings_item = MenuItem::with_id(app, "settings", "设置", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let exit_item = MenuItem::with_id(app, "exit", "退出", true, None::<&str>)?;
            let tray_menu = Menu::with_items(
                app,
                &[&show_item, &notes_item, &settings_item, &separator, &exit_item],
            )?;
            let mut tray = TrayIconBuilder::new()
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .tooltip("MD Code");
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.on_menu_event(|app, event| match event.id.as_ref() {
                "show" => show_main_window(app),
                "notes" => open_main_page(app, OPEN_NOTES_EVENT),
                "settings" => open_main_page(app, OPEN_SETTINGS_EVENT),
                "exit" => {
                    show_main_window(app);
                    let _ = app.emit(REQUEST_EXIT_EVENT, ());
                }
                _ => {}
            })
            .on_tray_icon_event(|tray, event| {
                if let TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } = event
                {
                    show_main_window(tray.app_handle());
                }
            })
            .build(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            write_binary_file,
            rename_text_file,
            reveal_in_file_manager,
            open_directory,
            resolve_notes_directory,
            load_notes,
            save_note,
            delete_note,
            initial_open_paths,
            sync_file_watcher,
            schedule_webview_cache_cleanup,
            exit_application,
            open_notes_window,
            open_main_settings,
            system_http_proxy
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
