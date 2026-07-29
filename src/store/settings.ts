import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';

export type ImageSaveMode = 'document' | 'custom';

interface PersistedSettings {
  newFileDirectory: string;
  imageSaveMode: ImageSaveMode;
  imageSubdirectory: string;
  customImageDirectory: string;
}

const STORAGE_KEY = 'md-code-settings-v1';
const DEFAULT_IMAGE_DIRECTORY = 'images';

function loadSettings(): Partial<PersistedSettings> {
  if (typeof window === 'undefined' || !('localStorage' in window)) return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<PersistedSettings>;
  } catch {
    return {};
  }
}

function parentDirectory(filePath: string): string {
  const index = Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'));
  return index >= 0 ? filePath.slice(0, index) : '';
}

function joinPath(directory: string, child: string): string {
  const separator = directory.includes('\\') || /^[a-z]:/iu.test(directory) ? '\\' : '/';
  return `${directory.replace(/[\\/]+$/u, '')}${separator}${child.replace(/^[\\/]+/u, '')}`;
}

export const useSettingsStore = defineStore('settings', () => {
  const saved = loadSettings();
  const newFileDirectory = ref(saved.newFileDirectory ?? '');
  const imageSaveMode = ref<ImageSaveMode>(saved.imageSaveMode === 'custom' ? 'custom' : 'document');
  const imageSubdirectory = ref(saved.imageSubdirectory?.trim() || DEFAULT_IMAGE_DIRECTORY);
  const customImageDirectory = ref(saved.customImageDirectory ?? '');

  const normalizedImageSubdirectory = computed(
    () => imageSubdirectory.value.trim().replace(/^[\\/]+|[\\/]+$/gu, '') || DEFAULT_IMAGE_DIRECTORY
  );

  function resolveImageDirectory(documentPath: string | null): string | null {
    if (imageSaveMode.value === 'custom') return customImageDirectory.value.trim() || null;
    if (!documentPath) return null;
    const directory = parentDirectory(documentPath);
    return directory ? joinPath(directory, normalizedImageSubdirectory.value) : null;
  }

  function setImageSaveMode(mode: ImageSaveMode): void {
    imageSaveMode.value = mode;
  }

  function setNewFileDirectory(value: string): void {
    newFileDirectory.value = value;
  }

  function setImageSubdirectory(value: string): void {
    imageSubdirectory.value = value;
  }

  function setCustomImageDirectory(value: string): void {
    customImageDirectory.value = value;
  }

  watch(
    [newFileDirectory, imageSaveMode, imageSubdirectory, customImageDirectory],
    () => {
      if (typeof window === 'undefined' || !('localStorage' in window)) return;
      const snapshot: PersistedSettings = {
        newFileDirectory: newFileDirectory.value.trim(),
        imageSaveMode: imageSaveMode.value,
        imageSubdirectory: normalizedImageSubdirectory.value,
        customImageDirectory: customImageDirectory.value
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    },
    { deep: true }
  );

  return {
    newFileDirectory,
    imageSaveMode,
    imageSubdirectory,
    customImageDirectory,
    normalizedImageSubdirectory,
    resolveImageDirectory,
    setNewFileDirectory,
    setImageSaveMode,
    setImageSubdirectory,
    setCustomImageDirectory
  };
});
