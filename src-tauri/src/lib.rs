mod commands;
mod file_watcher;
mod startup_files;

use commands::filesystem::{
    read_text_file, reveal_in_file_manager, write_binary_file, write_text_file,
};
use file_watcher::{sync_file_watcher, FileWatcherState};
use startup_files::{initial_open_paths, paths_from_args};
use tauri::{Emitter, Manager};

const OPEN_FILES_EVENT: &str = "md-code://open-files";

#[tauri::command]
fn exit_application(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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
        .setup(|app| {
            app.manage(FileWatcherState::new(app.handle().clone())?);
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
            read_text_file,
            write_text_file,
            write_binary_file,
            reveal_in_file_manager,
            initial_open_paths,
            sync_file_watcher,
            exit_application
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
