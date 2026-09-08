use crate::application_data::ApplicationDataPaths;
use serde::{Deserialize, Serialize};
use std::{fs, path::{Path, PathBuf}, time::UNIX_EPOCH};

const NOTES_DIRECTORY_NAME: &str = "notes";
const NOTES_METADATA_DIRECTORY_NAME: &str = "notes-metadata";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteFile {
    id: String,
    name: String,
    custom_name: bool,
    content: String,
    updated_at: u64,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct NoteMetadata {
    name: String,
    custom_name: bool,
}

fn notes_directory(paths: &ApplicationDataPaths, custom: Option<String>) -> PathBuf {
    custom.filter(|value| !value.trim().is_empty()).map(PathBuf::from)
        .unwrap_or_else(|| paths.root.join(NOTES_DIRECTORY_NAME))
}

fn note_path(directory: &Path, id: &str) -> Result<PathBuf, String> {
    let name = Path::new(id);
    if id.is_empty()
        || name.components().count() != 1
        || !matches!(name.components().next(), Some(std::path::Component::Normal(_)))
    {
        return Err("便签标识无效".to_string());
    }
    Ok(directory.join(format!("{id}.md")))
}

fn metadata_path(paths: &ApplicationDataPaths, id: &str) -> Result<PathBuf, String> {
    note_path(&paths.root, id)?;
    Ok(paths.root.join(NOTES_METADATA_DIRECTORY_NAME).join(format!("{id}.json")))
}

fn content_name(content: &str) -> String {
    content
        .lines()
        .find(|line| !line.trim().is_empty())
        .map(|line| line.trim_start_matches('#').trim())
        .filter(|line| !line.is_empty())
        .unwrap_or("新便签")
        .chars()
        .take(60)
        .collect()
}

#[tauri::command]
pub fn resolve_notes_directory(paths: tauri::State<'_, ApplicationDataPaths>, custom_directory: Option<String>) -> Result<String, String> {
    let directory = notes_directory(&paths, custom_directory);
    fs::create_dir_all(&directory).map_err(|error| format!("创建便签目录失败：{error}"))?;
    Ok(directory.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn load_notes(paths: tauri::State<'_, ApplicationDataPaths>, custom_directory: Option<String>) -> Result<Vec<NoteFile>, String> {
    let directory = notes_directory(&paths, custom_directory);
    fs::create_dir_all(&directory).map_err(|error| format!("创建便签目录失败：{error}"))?;
    let mut notes = Vec::new();
    for entry in fs::read_dir(&directory).map_err(|error| format!("读取便签目录失败：{error}"))? {
        let entry = entry.map_err(|error| format!("读取便签失败：{error}"))?;
        let path = entry.path();
        if !path.is_file() || path.extension().and_then(|value| value.to_str()) != Some("md") { continue; }
        let Some(id) = path.file_stem().and_then(|value| value.to_str()) else { continue };
        let content = fs::read_to_string(&path).map_err(|error| format!("读取便签失败：{error}"))?;
        let metadata = metadata_path(&paths, id).ok()
            .and_then(|path| fs::read_to_string(path).ok())
            .and_then(|value| serde_json::from_str::<NoteMetadata>(&value).ok());
        let custom_name = metadata.as_ref().is_some_and(|value| value.custom_name);
        let name = metadata.filter(|value| value.custom_name && !value.name.trim().is_empty())
            .map(|value| value.name)
            .unwrap_or_else(|| content_name(&content));
        let updated_at = entry.metadata().ok().and_then(|value| value.modified().ok())
            .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
            .map(|value| value.as_millis().min(u64::MAX as u128) as u64).unwrap_or(0);
        notes.push(NoteFile { id: id.to_string(), name, custom_name, content, updated_at });
    }
    notes.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
    Ok(notes)
}

#[tauri::command]
pub fn save_note(paths: tauri::State<'_, ApplicationDataPaths>, custom_directory: Option<String>, id: String, name: String, custom_name: bool, content: String) -> Result<(), String> {
    let directory = notes_directory(&paths, custom_directory);
    fs::create_dir_all(&directory).map_err(|error| format!("创建便签目录失败：{error}"))?;
    fs::create_dir_all(paths.root.join(NOTES_METADATA_DIRECTORY_NAME)).map_err(|error| format!("创建便签名称目录失败：{error}"))?;
    let target = note_path(&directory, &id)?;
    let temporary = directory.join(format!(".{id}.saving"));
    let backup = directory.join(format!(".{id}.backup"));
    fs::write(&temporary, content).map_err(|error| format!("保存便签失败：{error}"))?;
    let had_target = target.exists();
    if had_target {
        if backup.exists() { fs::remove_file(&backup).map_err(|error| format!("清理便签备份失败：{error}"))?; }
        fs::rename(&target, &backup).map_err(|error| format!("备份原便签失败：{error}"))?;
    }
    if let Err(error) = fs::rename(&temporary, &target) {
        if had_target { let _ = fs::rename(&backup, &target); }
        return Err(format!("完成便签保存失败：{error}"));
    }
    if had_target { let _ = fs::remove_file(backup); }
    let metadata = NoteMetadata { name, custom_name };
    let metadata_content = serde_json::to_string(&metadata).map_err(|error| format!("生成便签名称信息失败：{error}"))?;
    fs::write(metadata_path(&paths, &id)?, metadata_content).map_err(|error| format!("保存便签名称失败：{error}"))?;
    Ok(())
}

#[tauri::command]
pub fn delete_note(paths: tauri::State<'_, ApplicationDataPaths>, custom_directory: Option<String>, id: String) -> Result<(), String> {
    let directory = notes_directory(&paths, custom_directory);
    let target = note_path(&directory, &id)?;
    let metadata = metadata_path(&paths, &id)?;
    if metadata.exists() { fs::remove_file(metadata).map_err(|error| format!("删除便签名称失败：{error}"))?; }
    if target.exists() { fs::remove_file(target).map_err(|error| format!("删除便签失败：{error}"))?; }
    Ok(())
}
