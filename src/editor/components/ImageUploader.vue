<script setup lang="ts">
import { ref } from 'vue';
import { showDesktopMessage } from '@/filesystem/fileSystemService';
import { saveMarkdownImage } from '@/editor/images/saveMarkdownImage';

const props = defineProps<{ documentPath: string | null }>();
const emit = defineEmits<{ insert: [markdown: string] }>();
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

async function onChange(event: Event): Promise<void> {
  const element = event.target as HTMLInputElement;
  const file = element.files?.[0];
  if (!file) return;
  const documentPath = props.documentPath;

  try {
    const cropped = mode === 'crop';
    const content = cropped ? await cropCenterSquare(file) : file;
    const image = await saveMarkdownImage(file, documentPath, content);
    if (props.documentPath === documentPath) emit('insert', image.markdown);
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
