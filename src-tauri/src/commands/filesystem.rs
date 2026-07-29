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
