<script setup lang="ts">
import { ref } from 'vue';
import { showDesktopMessage, writeBinaryFile } from '@/filesystem/fileSystemService';
import { useSettingsStore } from '@/store/settings';

const props = defineProps<{ documentPath: string | null }>();
const emit = defineEmits<{ insert: [markdown: string] }>();
const settingsStore = useSettingsStore();
const input = ref<HTMLInputElement>();
let mode: 'upload' | 'crop' = 'upload';

function open(nextMode: 'upload' | 'crop' = 'upload'): void {
  mode = nextMode;
  input.value?.click();
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () => reject(new Error('无法读取图片')));
    image.src = source;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('图片裁剪失败'))),
      mimeType === 'image/png' ? 'image/png' : 'image/jpeg',
      0.9
    );
  });
}

async function cropCenterSquare(file: File): Promise<Blob> {
  const source = URL.createObjectURL(file);
  try {
    const image = await loadImage(source);
    const size = Math.min(image.naturalWidth, image.naturalHeight);
    const sourceX = (image.naturalWidth - size) / 2;
    const sourceY = (image.naturalHeight - size) / 2;
    const outputSize = Math.min(size, 1600);
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法创建图片画布');
    context.drawImage(image, sourceX, sourceY, size, size, 0, 0, outputSize, outputSize);
    return canvasToBlob(canvas, file.type);
  } finally {
    URL.revokeObjectURL(source);
  }
}

function joinPath(directory: string, filename: string): string {
  const separator = directory.includes('\\') || /^[a-z]:/iu.test(directory) ? '\\' : '/';
  return `${directory.replace(/[\\/]+$/u, '')}${separator}${filename}`;
}

function safeFilename(file: File, cropped: boolean): string {
  const extensionFromName = file.name.match(/\.([a-z0-9]+)$/iu)?.[1]?.toLowerCase();
  const extension = cropped && file.type !== 'image/png' ? 'jpg' : extensionFromName || 'png';
  const base = file.name
    .replace(/\.[^.]+$/u, '')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^-+|-+$/gu, '') || 'image';
  return `${base}-${Date.now()}.${extension}`;
}

function fileUrl(filePath: string): string {
  const normalized = filePath.replaceAll('\\', '/');
  return encodeURI(/^[a-z]:\//iu.test(normalized) ? `file:///${normalized}` : `file://${normalized}`);
}

async function onChange(event: Event): Promise<void> {
  const element = event.target as HTMLInputElement;
  const file = element.files?.[0];
  if (!file) return;

  try {
    const targetDirectory = settingsStore.resolveImageDirectory(props.documentPath);
    if (!targetDirectory) {
      const message = settingsStore.imageSaveMode === 'document'
        ? '请先保存当前 Markdown 文件，再上传图片。默认图片目录会创建在文档同级的 images 文件夹中。'
        : '请先在“设置”中选择自定义图片保存目录。';
      await showDesktopMessage(message, '无法保存图片');
      return;
    }

    const cropped = mode === 'crop';
    const content = cropped ? await cropCenterSquare(file) : file;
    const filename = safeFilename(file, cropped);
    const targetPath = joinPath(targetDirectory, filename);
    await writeBinaryFile(targetPath, new Uint8Array(await content.arrayBuffer()));

    const source = settingsStore.imageSaveMode === 'document'
      ? encodeURI(`${settingsStore.normalizedImageSubdirectory}/${filename}`)
      : fileUrl(targetPath);
    const alt = file.name.replace(/\.[^.]+$/u, '');
    emit('insert', `![${alt}](${source})`);
  } catch (error) {
    await showDesktopMessage(error instanceof Error ? error.message : '保存图片失败', '图片保存失败');
  } finally {
    element.value = '';
  }
}

defineExpose({ open });
</script>

<template>
  <input ref="input" class="hidden-input" type="file" accept="image/*" @change="onChange" />
</template>

<style scoped>
.hidden-input {
  display: none;
}
</style>
