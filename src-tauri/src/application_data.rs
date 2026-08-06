use std::{
    fs,
    path::{Path, PathBuf},
};

#[cfg(all(windows, not(debug_assertions)))]
use std::io;

#[cfg(all(windows, not(debug_assertions)))]
const APP_IDENTIFIER: &str = "com.mdcode.desktop";
const DATA_DIRECTORY_NAME: &str = "data";
const WEBVIEW_DIRECTORY_NAME: &str = "EBWebView";
const CACHE_CLEANUP_MARKER: &str = ".clear-webview-cache-on-start";
const MAX_REGENERABLE_CACHE_BYTES: u64 = 128 * 1024 * 1024;
const WEBVIEW_CACHE_DIRECTORIES: &[&[&str]] = &[
    &["Default", "Cache"],
    &["Default", "Code Cache"],
    &["Default", "GPUCache"],
    &["Default", "DawnGraphiteCache"],
    &["Default", "DawnWebGPUCache"],
    &["Default", "Media Cache"],
    &["Default", "Shared Dictionary"],
    &["component_crx_cache"],
    &["GraphiteDawnCache"],
    &["GrShaderCache"],
    &["ShaderCache"],
];

#[derive(Clone)]
pub struct ApplicationDataPaths {
    pub root: PathBuf,
    pub webview: PathBuf,
    pub webview_environment_root: PathBuf,
}

pub fn prepare() -> ApplicationDataPaths {
    let executable_directory = std::env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(Path::to_path_buf))
        .or_else(|| std::env::current_dir().ok())
        .unwrap_or_else(|| PathBuf::from("."));
    let executable_data_root = executable_directory.join(DATA_DIRECTORY_NAME);
    #[cfg(debug_assertions)]
    let root = prepare_development_data_root(&executable_data_root);
    #[cfg(not(debug_assertions))]
    let root = executable_data_root;
    let preferred_webview = root.join(WEBVIEW_DIRECTORY_NAME);
    let _ = fs::create_dir_all(&root);

    #[cfg(all(windows, not(debug_assertions)))]
    let migrated_webview =
        migrate_legacy_data(&root, &preferred_webview).unwrap_or_else(|| preferred_webview.clone());
    #[cfg(any(not(windows), debug_assertions))]
    let migrated_webview = preferred_webview;

    #[cfg(windows)]
    let webview = normalize_nested_webview_profile(&root, &migrated_webview);
    #[cfg(not(windows))]
    let webview = migrated_webview;
    let webview_environment_root = webview
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| root.clone());

    let paths = ApplicationDataPaths {
        root,
        webview,
        webview_environment_root,
    };
    clear_scheduled_webview_cache(&paths);
    clear_oversized_webview_cache(&paths);
    paths
}

#[cfg(debug_assertions)]
fn prepare_development_data_root(previous_root: &Path) -> PathBuf {
    let preferred_root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(".dev-data");
    if preferred_root.exists() || !previous_root.exists() {
        return preferred_root;
    }
    if fs::rename(previous_root, &preferred_root).is_ok() {
        preferred_root
    } else {
        previous_root.to_path_buf()
    }
}

#[tauri::command]
pub fn schedule_webview_cache_cleanup(
    paths: tauri::State<'_, ApplicationDataPaths>,
) -> Result<u64, String> {
    let estimated_bytes = webview_cache_size(&paths.webview);
    fs::create_dir_all(&paths.root).map_err(|error| error.to_string())?;
    fs::write(
        paths.root.join(CACHE_CLEANUP_MARKER),
        b"Clear regenerable WebView cache before the next WebView starts.\n",
    )
    .map_err(|error| error.to_string())?;
    Ok(estimated_bytes)
}

fn clear_scheduled_webview_cache(paths: &ApplicationDataPaths) {
    let marker = paths.root.join(CACHE_CLEANUP_MARKER);
    if !marker.exists() {
        return;
    }

    if clear_webview_cache_directories(&paths.webview) {
        let _ = fs::remove_file(marker);
    }
}

fn clear_oversized_webview_cache(paths: &ApplicationDataPaths) {
    if webview_cache_size(&paths.webview) > MAX_REGENERABLE_CACHE_BYTES {
        let _ = clear_webview_cache_directories(&paths.webview);
    }
}

fn clear_webview_cache_directories(webview_root: &Path) -> bool {
    let mut cleanup_succeeded = true;
    for cache_directory in webview_cache_directories(webview_root) {
        if cache_directory.exists() && fs::remove_dir_all(cache_directory).is_err() {
            cleanup_succeeded = false;
        }
    }
    cleanup_succeeded
}

fn webview_cache_size(webview_root: &Path) -> u64 {
    webview_cache_directories(webview_root)
        .iter()
        .map(|directory| directory_size(directory))
        .fold(0, u64::saturating_add)
}

fn webview_cache_directories(webview_root: &Path) -> Vec<PathBuf> {
    WEBVIEW_CACHE_DIRECTORIES
        .iter()
        .map(|segments| {
            segments
                .iter()
                .fold(webview_root.to_path_buf(), |path, segment| {
                    path.join(segment)
                })
        })
        .collect()
}

fn directory_size(path: &Path) -> u64 {
    let Ok(entries) = fs::read_dir(path) else {
        return 0;
    };

    entries
        .filter_map(Result::ok)
        .map(|entry| {
            let Ok(file_type) = entry.file_type() else {
                return 0;
            };
            if file_type.is_dir() {
                directory_size(&entry.path())
            } else if file_type.is_file() {
                entry.metadata().map(|metadata| metadata.len()).unwrap_or(0)
            } else {
                0
            }
        })
        .fold(0, u64::saturating_add)
}

#[cfg(windows)]
fn normalize_nested_webview_profile(root: &Path, webview: &Path) -> PathBuf {
    let nested_webview = webview.join(WEBVIEW_DIRECTORY_NAME);
    if !nested_webview.join("Default").exists() {
        return webview.to_path_buf();
    }

    let staging = root.join(".webview-profile-migration");
    if staging.exists() && fs::remove_dir_all(&staging).is_err() {
        return nested_webview;
    }
    if fs::rename(&nested_webview, &staging).is_err() {
        return nested_webview;
    }
    if fs::remove_dir_all(webview).is_err() || fs::rename(&staging, webview).is_err() {
        let _ = fs::create_dir_all(webview);
        let restored_nested = webview.join(WEBVIEW_DIRECTORY_NAME);
        let _ = fs::rename(&staging, &restored_nested);
        return restored_nested;
    }

    webview.to_path_buf()
}

#[cfg(all(windows, not(debug_assertions)))]
fn migrate_legacy_data(root: &Path, preferred_webview: &Path) -> Option<PathBuf> {
    let legacy_root = std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)?
        .join(APP_IDENTIFIER);
    let legacy_webview = legacy_root.join(WEBVIEW_DIRECTORY_NAME);

    if !preferred_webview.exists() && legacy_webview.exists() {
        if migrate_directory(&legacy_webview, preferred_webview).is_err() {
            return Some(legacy_webview);
        }
    }

    let legacy_logs = legacy_root.join("logs");
    let target_logs = root.join("logs");
    if legacy_logs.exists() && !target_logs.exists() {
        let _ = migrate_directory(&legacy_logs, &target_logs);
    }
    let _ = fs::remove_dir(&legacy_root);
    Some(preferred_webview.to_path_buf())
}

#[cfg(all(windows, not(debug_assertions)))]
fn migrate_directory(source: &Path, target: &Path) -> io::Result<()> {
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }
    if fs::rename(source, target).is_ok() {
        return Ok(());
    }

    let staging = target.with_extension("migrating");
    if staging.exists() {
        fs::remove_dir_all(&staging)?;
    }
    copy_directory(source, &staging)?;
    fs::rename(&staging, target)?;
    fs::remove_dir_all(source)?;
    Ok(())
}

#[cfg(all(windows, not(debug_assertions)))]
fn copy_directory(source: &Path, target: &Path) -> io::Result<()> {
    fs::create_dir_all(target)?;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let source_path = entry.path();
        let target_path = target.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_directory(&source_path, &target_path)?;
        } else {
            fs::copy(source_path, target_path)?;
        }
    }
    Ok(())
}
