use serde::{Deserialize, Serialize};
use std::{
    env, fs,
    io::Write,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::Mutex,
};
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_dialog::DialogExt;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

const APP_NAME: &str = "MD Code";
const APP_VERSION: &str = "0.2.0";
const APP_EXECUTABLE: &str = "MD Code.exe";
const UNINSTALL_EXECUTABLE: &str = "uninstall.exe";
const INSTALL_MARKER: &str = ".md-code-install";
const CREATE_NO_WINDOW: u32 = 0x0800_0000;
const PAYLOAD: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/md-code-payload.exe"));

const SUPPORTED_EXTENSIONS: &[&str] = &[
    ".md",
    ".markdown",
    ".txt",
    ".json",
    ".html",
    ".htm",
    ".css",
    ".js",
    ".mjs",
    ".cjs",
    ".ts",
    ".mts",
    ".cts",
    ".yaml",
    ".yml",
    ".xml",
];

#[derive(Default)]
struct InstallerState {
    installed_executable: Mutex<Option<PathBuf>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InstallOptions {
    install_dir: String,
    create_desktop_shortcut: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct InstallProgress {
    percent: u8,
    message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct InstallResult {
    executable_path: String,
}

fn emit_progress(app: &AppHandle, percent: u8, message: impl Into<String>) {
    let _ = app.emit(
        "installer://progress",
        InstallProgress {
            percent,
            message: message.into(),
        },
    );
}

#[tauri::command]
fn get_default_install_dir() -> String {
    let data_drive = Path::new(r"D:\");
    if data_drive.is_dir() {
        return r"D:\app\MD Code".to_string();
    }

    env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(env::temp_dir)
        .join("Programs")
        .join(APP_NAME)
        .to_string_lossy()
        .into_owned()
}

#[tauri::command]
fn choose_install_dir(app: AppHandle, current_path: String) -> Result<Option<String>, String> {
    let mut dialog = app.dialog().file().set_title("选择 MD Code 安装位置");
    let current_path = current_path.trim();
    if !current_path.is_empty() {
        dialog = dialog.set_directory(current_path);
    }

    dialog
        .blocking_pick_folder()
        .map(|path| {
            path.into_path()
                .map(|path| path.to_string_lossy().into_owned())
                .map_err(|error| format!("无法读取所选目录：{error}"))
        })
        .transpose()
}

#[tauri::command]
async fn install_application(
    app: AppHandle,
    state: State<'_, InstallerState>,
    options: InstallOptions,
) -> Result<InstallResult, String> {
    let worker_app = app.clone();
    let executable =
        tauri::async_runtime::spawn_blocking(move || install_payload(&worker_app, &options))
            .await
            .map_err(|error| format!("安装任务异常结束：{error}"))??;

    *state
        .installed_executable
        .lock()
        .map_err(|_| "无法保存安装结果".to_string())? = Some(executable.clone());

    Ok(InstallResult {
        executable_path: executable.to_string_lossy().into_owned(),
    })
}

#[tauri::command]
fn launch_installed_application(state: State<'_, InstallerState>) -> Result<(), String> {
    let executable = state
        .installed_executable
        .lock()
        .map_err(|_| "无法读取安装结果".to_string())?
        .clone()
        .ok_or_else(|| "尚未完成安装".to_string())?;

    command(&executable)
        .spawn()
        .map_err(|error| format!("无法启动 MD Code：{error}"))?;
    Ok(())
}

fn install_payload(app: &AppHandle, options: &InstallOptions) -> Result<PathBuf, String> {
    if env!("MD_CODE_PAYLOAD_AVAILABLE") != "1" || PAYLOAD.is_empty() {
        return Err("未找到主程序。请使用 npm run installer:build 生成正式安装器。".to_string());
    }

    let install_dir = normalize_install_dir(&options.install_dir)?;
    let executable = install_dir.join(APP_EXECUTABLE);
    let temporary_executable = install_dir.join("MD Code.installing");
    let uninstaller = install_dir.join(UNINSTALL_EXECUTABLE);

    emit_progress(app, 3, "正在创建安装目录…");
    fs::create_dir_all(&install_dir).map_err(|error| {
        format!(
            "无法创建安装目录 {}：{error}",
            install_dir.to_string_lossy()
        )
    })?;

    emit_progress(app, 8, "正在写入应用文件…");
    let mut output = fs::File::create(&temporary_executable)
        .map_err(|error| format!("无法创建主程序文件：{error}"))?;
    let chunk_size = 256 * 1024;
    let total = PAYLOAD.len().max(1);

    for (index, chunk) in PAYLOAD.chunks(chunk_size).enumerate() {
        output
            .write_all(chunk)
            .map_err(|error| format!("写入主程序失败：{error}"))?;
        let written = ((index + 1) * chunk_size).min(total);
        let percent = 8 + ((written * 68 / total) as u8);
        emit_progress(app, percent.min(76), "正在安装 MD Code…");
    }
    output
        .sync_all()
        .map_err(|error| format!("保存主程序失败：{error}"))?;
    drop(output);

    if executable.exists() {
        fs::remove_file(&executable)
            .map_err(|error| format!("无法替换现有 MD Code，请先退出正在运行的程序：{error}"))?;
    }
    fs::rename(&temporary_executable, &executable)
        .map_err(|error| format!("无法完成主程序写入：{error}"))?;

    emit_progress(app, 80, "正在创建卸载程序…");
    if uninstaller.exists() {
        fs::remove_file(&uninstaller).map_err(|error| format!("无法更新卸载程序：{error}"))?;
    }
    fs::copy(
        env::current_exe().map_err(|error| format!("无法读取安装器路径：{error}"))?,
        &uninstaller,
    )
    .map_err(|error| format!("无法创建卸载程序：{error}"))?;

    emit_progress(app, 87, "正在创建快捷方式…");
    create_shortcuts(&executable, options.create_desktop_shortcut)?;

    emit_progress(app, 94, "正在写入系统安装信息…");
    register_uninstaller(&install_dir, &executable, &uninstaller)?;
    register_open_with(&executable)?;
    fs::write(install_dir.join(INSTALL_MARKER), APP_VERSION)
        .map_err(|error| format!("无法保存安装标记：{error}"))?;

    emit_progress(app, 100, "安装完成");
    Ok(executable)
}

fn normalize_install_dir(value: &str) -> Result<PathBuf, String> {
    let trimmed = value.trim().trim_matches('"');
    if trimmed.is_empty() {
        return Err("请选择安装位置".to_string());
    }

    let path = PathBuf::from(trimmed);
    if !path.is_absolute() || path.components().count() < 2 {
        return Err("安装路径无效".to_string());
    }
    Ok(path)
}

fn create_shortcuts(executable: &Path, create_desktop: bool) -> Result<(), String> {
    let app_data = env::var_os("APPDATA")
        .map(PathBuf::from)
        .ok_or_else(|| "无法读取开始菜单目录".to_string())?;
    let start_menu = app_data
        .join("Microsoft")
        .join("Windows")
        .join("Start Menu")
        .join("Programs")
        .join("MD Code.lnk");
    create_shortcut(executable, &start_menu)?;

    if create_desktop {
        let desktop = desktop_dir()?.join("MD Code.lnk");
        create_shortcut(executable, &desktop)?;
    }
    Ok(())
}

fn create_shortcut(executable: &Path, shortcut: &Path) -> Result<(), String> {
    let parent = shortcut
        .parent()
        .ok_or_else(|| "快捷方式路径无效".to_string())?;
    fs::create_dir_all(parent).map_err(|error| format!("无法创建快捷方式目录：{error}"))?;

    let script = format!(
        "$shell = New-Object -ComObject WScript.Shell; \
         $link = $shell.CreateShortcut('{}'); \
         $link.TargetPath = '{}'; \
         $link.WorkingDirectory = '{}'; \
         $link.IconLocation = '{}'; \
         $link.Save()",
        powershell_quote(shortcut),
        powershell_quote(executable),
        powershell_quote(
            executable
                .parent()
                .ok_or_else(|| "主程序路径无效".to_string())?
        ),
        powershell_quote(executable),
    );

    let status = command("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .status()
        .map_err(|error| format!("无法调用系统快捷方式服务：{error}"))?;
    if !status.success() {
        return Err("创建快捷方式失败".to_string());
    }
    Ok(())
}

fn register_uninstaller(
    install_dir: &Path,
    executable: &Path,
    uninstaller: &Path,
) -> Result<(), String> {
    let key = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\MD Code";
    reg_add(key, "DisplayName", "REG_SZ", APP_NAME)?;
    reg_add(key, "DisplayVersion", "REG_SZ", APP_VERSION)?;
    reg_add(key, "Publisher", "REG_SZ", "MD Code")?;
    reg_add(key, "DisplayIcon", "REG_SZ", &quoted(executable))?;
    reg_add(
        key,
        "InstallLocation",
        "REG_SZ",
        &install_dir.to_string_lossy(),
    )?;
    reg_add(
        key,
        "UninstallString",
        "REG_SZ",
        &format!("{} --uninstall", quoted(uninstaller)),
    )?;
    reg_add(key, "NoModify", "REG_DWORD", "1")?;
    reg_add(key, "NoRepair", "REG_DWORD", "1")?;
    Ok(())
}

fn register_open_with(executable: &Path) -> Result<(), String> {
    let base = r"HKCU\Software\Classes\Applications\MD Code.exe";
    reg_add(base, "FriendlyAppName", "REG_SZ", APP_NAME)?;
    reg_add(
        &format!(r"{base}\DefaultIcon"),
        "",
        "REG_SZ",
        &format!("{},0", quoted(executable)),
    )?;
    reg_add(
        &format!(r"{base}\shell\open\command"),
        "",
        "REG_SZ",
        &format!("{} \"%1\"", quoted(executable)),
    )?;
    let supported_types = format!(r"{base}\SupportedTypes");
    for extension in SUPPORTED_EXTENSIONS {
        reg_add(&supported_types, extension, "REG_SZ", "")?;
    }
    Ok(())
}

fn reg_add(key: &str, name: &str, kind: &str, data: &str) -> Result<(), String> {
    let mut args = vec!["ADD", key];
    if name.is_empty() {
        args.push("/ve");
    } else {
        args.extend(["/v", name]);
    }
    args.extend(["/t", kind, "/d", data, "/f"]);

    let status = command("reg.exe")
        .args(args)
        .status()
        .map_err(|error| format!("无法写入系统安装信息：{error}"))?;
    if !status.success() {
        return Err(format!("写入注册表失败：{key}"));
    }
    Ok(())
}

fn uninstall() -> Result<(), String> {
    let current_exe =
        env::current_exe().map_err(|error| format!("无法读取卸载程序路径：{error}"))?;
    let install_dir = current_exe
        .parent()
        .ok_or_else(|| "卸载路径无效".to_string())?
        .to_path_buf();
    if !install_dir.join(INSTALL_MARKER).is_file() {
        return Err("未找到 MD Code 安装标记，已停止卸载".to_string());
    }

    let _ = fs::remove_file(install_dir.join(APP_EXECUTABLE));
    let _ = fs::remove_file(install_dir.join(INSTALL_MARKER));
    let _ = remove_shortcuts();
    let _ = reg_delete(r"HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\MD Code");
    let _ = reg_delete(r"HKCU\Software\Classes\Applications\MD Code.exe");

    let cleanup = format!(
        "ping 127.0.0.1 -n 2 > nul & del /f /q {} & rmdir {}",
        quoted(&current_exe),
        quoted(&install_dir),
    );
    command("cmd.exe")
        .args(["/C", &cleanup])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("无法完成卸载清理：{error}"))?;
    Ok(())
}

fn remove_shortcuts() -> Result<(), String> {
    if let Ok(desktop) = desktop_dir() {
        let _ = fs::remove_file(desktop.join("MD Code.lnk"));
    }
    if let Some(app_data) = env::var_os("APPDATA") {
        let _ = fs::remove_file(
            PathBuf::from(app_data)
                .join("Microsoft")
                .join("Windows")
                .join("Start Menu")
                .join("Programs")
                .join("MD Code.lnk"),
        );
    }
    Ok(())
}

fn reg_delete(key: &str) -> Result<(), String> {
    command("reg.exe")
        .args(["DELETE", key, "/f"])
        .status()
        .map_err(|error| format!("无法删除系统安装信息：{error}"))?;
    Ok(())
}

fn desktop_dir() -> Result<PathBuf, String> {
    let output = command("powershell.exe")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "[Console]::OutputEncoding = [Text.Encoding]::UTF8; [Environment]::GetFolderPath('Desktop')",
        ])
        .output()
        .map_err(|error| format!("无法读取桌面目录：{error}"))?;

    if output.status.success() {
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !path.is_empty() {
            return Ok(PathBuf::from(path));
        }
    }

    env::var_os("USERPROFILE")
        .map(PathBuf::from)
        .map(|path| path.join("Desktop"))
        .ok_or_else(|| "无法读取桌面目录".to_string())
}

fn powershell_quote(path: &Path) -> String {
    path.to_string_lossy().replace('\'', "''")
}

fn quoted(path: &Path) -> String {
    format!("\"{}\"", path.to_string_lossy())
}

fn command(program: impl AsRef<std::ffi::OsStr>) -> Command {
    let mut command = Command::new(program);
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    command
}

pub fn run() {
    if env::args_os().any(|argument| argument == "--uninstall") {
        if let Err(error) = uninstall() {
            eprintln!("{error}");
        }
        return;
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(InstallerState::default())
        .invoke_handler(tauri::generate_handler![
            get_default_install_dir,
            choose_install_dir,
            install_application,
            launch_installed_application
        ])
        .run(tauri::generate_context!())
        .expect("error while running MD Code installer");
}
