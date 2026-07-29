import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';

export interface InstallOptions {
  installDir: string;
  createDesktopShortcut: boolean;
}

export interface InstallProgress {
  percent: number;
  message: string;
}

export interface InstallResult {
  executablePath: string;
}

type ProgressHandler = (progress: InstallProgress) => void;

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
}

export async function defaultInstallDir(): Promise<string> {
  if (!isTauriRuntime()) return 'D:\\app\\MD Code';
  return invoke<string>('default_install_dir');
}

export async function chooseInstallDir(currentPath: string): Promise<string | null> {
  if (!isTauriRuntime()) return currentPath;
  const selected = await open({
    directory: true,
    multiple: false,
    defaultPath: currentPath,
    title: '选择 MD Code 安装位置'
  });
  return typeof selected === 'string' ? selected : null;
}

export async function minimizeInstaller(): Promise<void> {
  if (!isTauriRuntime()) return;
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  await getCurrentWindow().minimize();
}

export async function closeInstaller(): Promise<void> {
  if (!isTauriRuntime()) return;
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  await getCurrentWindow().close();
}

export async function installApplication(
  options: InstallOptions,
  onProgress: ProgressHandler
): Promise<InstallResult> {
  if (!isTauriRuntime()) return runMockInstall(onProgress);

  const unlisten = await listen<InstallProgress>('installer://progress', (event) => {
    onProgress(event.payload);
  });
  try {
    return await invoke<InstallResult>('install_application', { options });
  } finally {
    unlisten();
  }
}

export async function launchInstalledApplication(): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke('launch_installed_application');
}

async function runMockInstall(onProgress: ProgressHandler): Promise<InstallResult> {
  const steps = [
    [4, '正在准备安装…'],
    [11, '正在创建安装目录…'],
    [25, '正在复制应用文件…'],
    [43, '正在复制应用文件…'],
    [62, '正在复制应用文件…'],
    [78, '正在配置应用…'],
    [89, '正在创建快捷方式…'],
    [96, '正在写入卸载信息…'],
    [100, '安装完成']
  ] as const;

  for (const [percent, message] of steps) {
    await new Promise((resolve) => window.setTimeout(resolve, 260));
    onProgress({ percent, message });
  }
  return { executablePath: 'D:\\app\\MD Code\\MD Code.exe' };
}
