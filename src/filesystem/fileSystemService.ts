import { invoke } from '@tauri-apps/api/core';
import { open, save, confirm, message } from '@tauri-apps/plugin-dialog';
import { extensionFromFilename, supportedFileExtensions } from '@/editor/language/languageManager';

export interface OpenedTextFile {
  path: string | null;
  filename: string;
  content: string;
}

export interface SaveResult {
  saved: boolean;
  path: string | null;
}

const supportedExtensionSet = new Set(supportedFileExtensions());

export function isSupportedTextPath(path: string): boolean {
  return supportedExtensionSet.has(extensionFromFilename(path));
}
export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function filenameFromPath(path: string): string {
  return path.split(/[\\/]/u).pop() || 'Untitled.txt';
}

function browserOpenFiles(): Promise<OpenedTextFile[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = supportedFileExtensions().map((extension) => '.' + extension).join(',') + ',text/*';
    input.addEventListener('cancel', () => resolve([]), { once: true });
    input.addEventListener('change', async () => {
      const files = [...(input.files ?? [])];
      resolve(
        await Promise.all(
          files.map(async (file) => ({
            path: null,
            filename: file.name,
            content: await file.text()
          }))
        )
      );
    });
    input.click();
  });
}

export async function openTextFiles(): Promise<OpenedTextFile[]> {
  if (!isTauriRuntime()) return browserOpenFiles();
  const selected = await open({
    multiple: true,
    directory: false,
    filters: [
      { name: 'Supported Documents', extensions: supportedFileExtensions() },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  const paths = selected ? (Array.isArray(selected) ? selected : [selected]) : [];
  return Promise.all(
    paths.map(async (path) => ({
      path,
      filename: filenameFromPath(path),
      content: await invoke<string>('read_text_file', { path })
    }))
  );
}

export async function readTextFile(path: string): Promise<OpenedTextFile> {
  const content = await invoke<string>('read_text_file', { path });
  return { path, filename: filenameFromPath(path), content };
}

function downloadText(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function saveTextFile(input: {
  path: string | null;
  filename: string;
  content: string;
  saveAs?: boolean;
  defaultDirectory?: string;
}): Promise<SaveResult> {
  if (!isTauriRuntime()) {
    downloadText(input.filename, input.content);
    return { saved: true, path: input.path };
  }

  let target = input.path;
  if (input.saveAs || !target) {
    const extension = extensionFromFilename(input.filename) || 'txt';
    const directory = input.defaultDirectory?.trim().replace(/[\\/]+$/u, '');
    const separator = directory?.includes('\\') || /^[a-z]:/iu.test(directory ?? '') ? '\\' : '/';
    target = await save({
      defaultPath: directory ? `${directory}${separator}${input.filename}` : input.filename,
      filters: [{ name: 'Document', extensions: [extension] }]
    });
  }
  if (!target) return { saved: false, path: input.path };
  await invoke('write_text_file', { path: target, content: input.content });
  return { saved: true, path: target };
}

export async function chooseDirectory(defaultPath?: string): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const selected = await open({
    directory: true,
    multiple: false,
    defaultPath
  });
  return typeof selected === 'string' ? selected : null;
}

export async function writeBinaryFile(path: string, bytes: Uint8Array): Promise<void> {
  if (!isTauriRuntime()) throw new Error('浏览器预览模式无法写入本地图片文件');
  await invoke('write_binary_file', { path, bytes: Array.from(bytes) });
}

export async function renameTextFile(path: string, newFilename: string): Promise<string> {
  if (!isTauriRuntime()) throw new Error('浏览器预览模式无法重命名本地文件');
  return invoke<string>('rename_text_file', { path, newFilename });
}

export async function revealInFileManager(path: string): Promise<void> {
  if (!isTauriRuntime()) throw new Error('浏览器预览模式无法打开文件资源管理器');
  await invoke('reveal_in_file_manager', { path });
}

export async function copyTextToClipboard(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // WebView 未授予 Clipboard API 权限时，继续使用兼容方案。
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.setAttribute('readonly', '');
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('复制路径失败');
}

export async function confirmDesktop(messageText: string, title = 'MD Code'): Promise<boolean> {
  if (!isTauriRuntime()) return window.confirm(messageText);
  return confirm(messageText, { title, kind: 'warning' });
}

export async function showDesktopMessage(messageText: string, title = 'MD Code'): Promise<void> {
  if (!isTauriRuntime()) {
    window.alert(messageText);
    return;
  }
  await message(messageText, { title, kind: 'error' });
}

