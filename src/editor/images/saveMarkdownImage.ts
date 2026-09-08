import { writeBinaryFile } from '@/filesystem/fileSystemService';
import { useSettingsStore } from '@/store/settings';

/** Shared by file selection, clipboard paste and the visual note editor. */
export async function saveMarkdownImage(file: File, documentPath: string | null, content: Blob = file) {
  const settings = useSettingsStore();
  if (settings.imageSaveMode === 'document' && settings.normalizedImageSubdirectory.split(/[\\/]/u)
    .some(part => part === '..' || part === '.' || /[:<>"|?*]/u.test(part))) {
    throw new Error('图片子文件夹名称无效，请在设置中填写当前文档目录下的文件夹名称。');
  }
  const directory = settings.resolveImageDirectory(documentPath);
  const saveMode = settings.imageSaveMode;
  const subdirectory = settings.normalizedImageSubdirectory.replaceAll('\\', '/');
  if (!directory) {
    throw new Error(settings.imageSaveMode === 'document'
      ? '请先保存当前 Markdown 文件，再粘贴或上传图片。'
      : '请先在设置中选择图片保存目录。');
  }
  const extensions: Record<string, string> = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif',
    'image/webp': 'webp', 'image/bmp': 'bmp', 'image/svg+xml': 'svg'
  };
  const extension = extensions[content.type] ?? file.name.match(/\.([a-z0-9]+)$/iu)?.[1] ?? 'png';
  const base = file.name.replace(/\.[^.]+$/u, '').replace(/[^\p{L}\p{N}._-]+/gu, '-') || 'image';
  const filename = `${base}-${crypto.randomUUID()}.${extension}`;
  const separator = directory.includes('\\') ? '\\' : '/';
  const target = `${directory.replace(/[\\/]+$/u, '')}${separator}${filename}`;
  await writeBinaryFile(target, new Uint8Array(await content.arrayBuffer()));
  const normalized = target.replaceAll('\\', '/');
  const source = saveMode === 'document'
    ? encodeURI(`${subdirectory}/${filename}`).replaceAll('#', '%23')
    : encodeURI(/^[a-z]:\//iu.test(normalized) ? `file:///${normalized}` : `file://${normalized}`).replaceAll('#', '%23').replaceAll('?', '%3F');
  const alt = base.replace(/[\[\]\\]/gu, '');
  return { source, markdown: `![${alt}](<${source}>)` };
}
