use std::{
    env,
    path::{Path, PathBuf},
};

const SUPPORTED_EXTENSIONS: &[&str] = &[
    "md", "markdown", "mdown", "mkd", "json", "jsonc", "html", "htm", "css", "scss", "less", "js",
    "mjs", "cjs", "jsx", "ts", "mts", "cts", "tsx", "yaml", "yml", "xml", "svg", "txt", "log",
    "ini", "conf",
];

fn supported_file(path: &Path) -> bool {
    path.is_file()
        && path
            .extension()
            .and_then(|extension| extension.to_str())
            .is_some_and(|extension| {
                SUPPORTED_EXTENSIONS
                    .iter()
                    .any(|supported| extension.eq_ignore_ascii_case(supported))
            })
}

pub fn paths_from_args(args: impl IntoIterator<Item = String>, cwd: Option<&str>) -> Vec<String> {
    let base = cwd.map(PathBuf::from);
    args.into_iter()
        .skip(1)
        .map(PathBuf::from)
        .map(|path| {
            if path.is_absolute() {
                path
            } else if let Some(base) = &base {
                base.join(path)
            } else {
                path
            }
        })
        .filter(|path| supported_file(path))
        .map(|path| path.to_string_lossy().into_owned())
        .collect()
}

#[tauri::command]
pub fn initial_open_paths() -> Vec<String> {
    let cwd = env::current_dir()
        .ok()
        .and_then(|path| path.to_str().map(str::to_owned));
    paths_from_args(env::args(), cwd.as_deref())
}
