use std::{fs, path::Path, process::Command};

#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|error| format!("读取文件失败：{error}"))
}

#[tauri::command]
pub fn write_text_file(path: String, content: String) -> Result<(), String> {
    let target = Path::new(&path);
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("创建目录失败：{error}"))?;
    }
    fs::write(target, content).map_err(|error| format!("保存文件失败：{error}"))
}

#[tauri::command]
pub fn write_binary_file(path: String, bytes: Vec<u8>) -> Result<(), String> {
    let target = Path::new(&path);
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("创建图片目录失败：{error}"))?;
    }
    fs::write(target, bytes).map_err(|error| format!("保存图片失败：{error}"))
}

#[tauri::command]
pub fn rename_text_file(path: String, new_filename: String) -> Result<String, String> {
    let source = Path::new(&path);
    if !source.is_file() {
        return Err("原文件不存在，无法重命名".to_string());
    }

    let filename = Path::new(new_filename.trim());
    if filename.as_os_str().is_empty()
        || filename.components().count() != 1
        || !matches!(
            filename.components().next(),
            Some(std::path::Component::Normal(_))
        )
    {
        return Err("文件名无效，请不要包含路径分隔符".to_string());
    }

    let parent = source
        .parent()
        .ok_or_else(|| "无法读取文件所在目录".to_string())?;
    let target = parent.join(filename);
    if target.exists() {
        let same_file = fs::canonicalize(source)
            .ok()
            .zip(fs::canonicalize(&target).ok())
            .is_some_and(|(left, right)| left == right);
        if !same_file {
            return Err("同一目录中已经存在同名文件".to_string());
        }
    }

    fs::rename(source, &target).map_err(|error| format!("重命名文件失败：{error}"))?;
    Ok(target.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn reveal_in_file_manager(path: String) -> Result<(), String> {
    let target = Path::new(&path);
    if !target.exists() {
        return Err("文件不存在，无法在文件资源管理器中打开".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        return Command::new("explorer.exe")
            .arg("/select,")
            .arg(target)
            .spawn()
            .map(|_| ())
            .map_err(|error| format!("打开文件资源管理器失败：{error}"));
    }

    #[cfg(target_os = "macos")]
    {
        return Command::new("open")
            .arg("-R")
            .arg(target)
            .spawn()
            .map(|_| ())
            .map_err(|error| format!("打开 Finder 失败：{error}"));
    }

    #[cfg(target_os = "linux")]
    {
        let directory = target.parent().unwrap_or(target);
        return Command::new("xdg-open")
            .arg(directory)
            .spawn()
            .map(|_| ())
            .map_err(|error| format!("打开文件管理器失败：{error}"));
    }

    #[allow(unreachable_code)]
    Err("当前平台不支持打开文件管理器".to_string())
}
