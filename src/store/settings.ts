import { defineStore } from 'pinia';
import { computed, reactive, ref, watch } from 'vue';

export type ImageSaveMode = 'document' | 'custom';
export type MonacoWordWrap = 'language' | 'on' | 'off';
export type MonacoRenderWhitespace = 'none' | 'boundary' | 'selection' | 'trailing' | 'all';

export interface MonacoSettings {
  fontSize: number;
  lineHeight: number;
  fontLigatures: boolean;
  tabSize: number;
  detectIndentation: boolean;
  wordWrap: MonacoWordWrap;
  minimap: boolean;
  stickyScroll: boolean;
  smoothScrolling: boolean;
  scrollBeyondLastLine: boolean;
  renderWhitespace: MonacoRenderWhitespace;
}

interface PersistedSettings {
  rememberWindowState: boolean;
  newFileDirectory: string;
  imageSaveMode: ImageSaveMode;
  imageSubdirectory: string;
  customImageDirectory: string;
  monaco: MonacoSettings;
}

const STORAGE_KEY = 'md-code-settings-v1';
const DEFAULT_IMAGE_DIRECTORY = 'images';
const DEFAULT_MONACO_SETTINGS: MonacoSettings = {
  fontSize: 14,
  lineHeight: 22,
  fontLigatures: true,
  tabSize: 2,
  detectIndentation: true,
  wordWrap: 'language',
  minimap: false,
  stickyScroll: false,
  smoothScrolling: true,
  scrollBeyondLastLine: true,
  renderWhitespace: 'selection'
};

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

function normalizeNumber(value: unknown, fallback: number, min: number, max: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(Math.min(max, Math.max(min, number))) : fallback;
}

function normalizeMonacoSettings(value: Partial<MonacoSettings> | undefined): MonacoSettings {
  const wordWrap: MonacoWordWrap =
    value?.wordWrap === 'on' || value?.wordWrap === 'off' ? value.wordWrap : 'language';
  const whitespaceValues: MonacoRenderWhitespace[] = [
    'none',
    'boundary',
    'selection',
    'trailing',
    'all'
  ];
  const renderWhitespace = whitespaceValues.includes(
    value?.renderWhitespace as MonacoRenderWhitespace
  )
    ? (value?.renderWhitespace as MonacoRenderWhitespace)
    : DEFAULT_MONACO_SETTINGS.renderWhitespace;

  return {
    fontSize: normalizeNumber(value?.fontSize, DEFAULT_MONACO_SETTINGS.fontSize, 10, 32),
    lineHeight: normalizeNumber(value?.lineHeight, DEFAULT_MONACO_SETTINGS.lineHeight, 16, 48),
    fontLigatures: value?.fontLigatures ?? DEFAULT_MONACO_SETTINGS.fontLigatures,
    tabSize: [2, 4, 8].includes(Number(value?.tabSize)) ? Number(value?.tabSize) : 2,
    detectIndentation: value?.detectIndentation ?? DEFAULT_MONACO_SETTINGS.detectIndentation,
    wordWrap,
    minimap: value?.minimap ?? DEFAULT_MONACO_SETTINGS.minimap,
    stickyScroll: value?.stickyScroll ?? DEFAULT_MONACO_SETTINGS.stickyScroll,
    smoothScrolling: value?.smoothScrolling ?? DEFAULT_MONACO_SETTINGS.smoothScrolling,
    scrollBeyondLastLine:
      value?.scrollBeyondLastLine ?? DEFAULT_MONACO_SETTINGS.scrollBeyondLastLine,
    renderWhitespace
  };
}

export const useSettingsStore = defineStore('settings', () => {
  const saved = loadSettings();
  const rememberWindowState = ref(saved.rememberWindowState ?? true);
  const newFileDirectory = ref(saved.newFileDirectory ?? '');
  const imageSaveMode = ref<ImageSaveMode>(
    saved.imageSaveMode === 'custom' ? 'custom' : 'document'
  );
  const imageSubdirectory = ref(saved.imageSubdirectory?.trim() || DEFAULT_IMAGE_DIRECTORY);
  const customImageDirectory = ref(saved.customImageDirectory ?? '');
  const monaco = reactive<MonacoSettings>(normalizeMonacoSettings(saved.monaco));

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

  function resetMonacoSettings(): void {
    Object.assign(monaco, DEFAULT_MONACO_SETTINGS);
  }

  watch(
    [
      rememberWindowState,
      newFileDirectory,
      imageSaveMode,
      imageSubdirectory,
      customImageDirectory,
      monaco
    ],
    () => {
      if (typeof window === 'undefined' || !('localStorage' in window)) return;
      const snapshot: PersistedSettings = {
        rememberWindowState: rememberWindowState.value,
        newFileDirectory: newFileDirectory.value.trim(),
        imageSaveMode: imageSaveMode.value,
        imageSubdirectory: normalizedImageSubdirectory.value,
        customImageDirectory: customImageDirectory.value,
        monaco: normalizeMonacoSettings(monaco)
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    },
    { deep: true }
  );

  return {
    rememberWindowState,
    newFileDirectory,
    imageSaveMode,
    imageSubdirectory,
    customImageDirectory,
    monaco,
    normalizedImageSubdirectory,
    resolveImageDirectory,
    setNewFileDirectory,
    setImageSaveMode,
    setImageSubdirectory,
    setCustomImageDirectory,
    resetMonacoSettings
  };
});
