use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::{
    collections::HashSet,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
};
use tauri::{AppHandle, Emitter, State};

const FILE_SYSTEM_CHANGED_EVENT: &str = "md-code://file-system-changed";

#[derive(Default)]
struct WatchTargets {
    opened_files: HashSet<PathBuf>,
    workspace_directory: Option<PathBuf>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct FileSystemChangedPayload {
    paths: Vec<String>,
    kind: String,
}

pub struct FileWatcherState {
    watcher: Mutex<RecommendedWatcher>,
    targets: Arc<Mutex<WatchTargets>>,
    watched_directories: Mutex<HashSet<PathBuf>>,
}

fn same_path(left: &Path, right: &Path) -> bool {
    if cfg!(windows) {
        left.to_string_lossy()
            .eq_ignore_ascii_case(&right.to_string_lossy())
    } else {
        left == right
    }
}

fn is_inside(path: &Path, directory: &Path) -> bool {
    if cfg!(windows) {
        let path = path.to_string_lossy().to_lowercase();
        let directory = directory.to_string_lossy().to_lowercase();
        path == directory
            || path
                .strip_prefix(&directory)
                .is_some_and(|rest| rest.starts_with('\\') || rest.starts_with('/'))
    } else {
        path.starts_with(directory)
    }
}

fn relevant_paths(event: &Event, targets: &WatchTargets) -> Vec<String> {
    event
        .paths
        .iter()
        .filter(|path| {
            targets
                .opened_files
                .iter()
                .any(|opened| same_path(path, opened))
                || targets
                    .workspace_directory
                    .as_ref()
                    .is_some_and(|workspace| is_inside(path, workspace))
        })
        .map(|path| path.to_string_lossy().into_owned())
        .collect()
}

impl FileWatcherState {
    pub fn new(app: AppHandle) -> notify::Result<Self> {
        let targets = Arc::new(Mutex::new(WatchTargets::default()));
        let callback_targets = Arc::clone(&targets);
        let watcher = notify::recommended_watcher(move |result: notify::Result<Event>| {
            let Ok(event) = result else {
                return;
            };
            if matches!(event.kind, EventKind::Access(_)) {
                return;
            }

            let paths = {
                let Ok(targets) = callback_targets.lock() else {
                    return;
                };
                relevant_paths(&event, &targets)
            };
            if paths.is_empty() {
                return;
            }

            let _ = app.emit(
                FILE_SYSTEM_CHANGED_EVENT,
                FileSystemChangedPayload {
                    paths,
                    kind: format!("{:?}", event.kind),
                },
            );
        })?;

        Ok(Self {
            watcher: Mutex::new(watcher),
            targets,
            watched_directories: Mutex::new(HashSet::new()),
        })
    }

    fn sync(
        &self,
        opened_files: Vec<String>,
        workspace_directory: Option<String>,
    ) -> Result<(), String> {
        let opened_files = opened_files
            .into_iter()
            .filter(|path| !path.trim().is_empty())
            .map(PathBuf::from)
            .collect::<HashSet<_>>();
        let workspace_directory = workspace_directory
            .filter(|path| !path.trim().is_empty())
            .map(PathBuf::from);

        let mut desired_directories = opened_files
            .iter()
            .filter_map(|path| path.parent().map(Path::to_path_buf))
            .collect::<HashSet<_>>();
        if let Some(workspace) = &workspace_directory {
            desired_directories.insert(workspace.clone());
        }

        let mut watcher = self
            .watcher
            .lock()
            .map_err(|_| "文件监听器状态不可用".to_string())?;
        let mut watched = self
            .watched_directories
            .lock()
            .map_err(|_| "文件监听目录状态不可用".to_string())?;

        for directory in watched
            .difference(&desired_directories)
            .cloned()
            .collect::<Vec<_>>()
        {
            let _ = watcher.unwatch(&directory);
            watched.remove(&directory);
        }
        for directory in desired_directories
            .difference(&watched)
            .cloned()
            .collect::<Vec<_>>()
        {
            watcher
                .watch(&directory, RecursiveMode::NonRecursive)
                .map_err(|error| format!("监听目录失败（{}）：{error}", directory.display()))?;
            watched.insert(directory);
        }

        let mut targets = self
            .targets
            .lock()
            .map_err(|_| "文件监听目标状态不可用".to_string())?;
        targets.opened_files = opened_files;
        targets.workspace_directory = workspace_directory;
        Ok(())
    }
}

#[tauri::command]
pub fn sync_file_watcher(
    state: State<'_, FileWatcherState>,
    opened_files: Vec<String>,
    workspace_directory: Option<String>,
) -> Result<(), String> {
    state.sync(opened_files, workspace_directory)
}
