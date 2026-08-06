import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { defaultModeForLanguage, detectLanguage } from '@/editor/language/languageManager';
import type {
  CodeThemeName,
  CursorPosition,
  EditorDocument,
  EditorMode,
  EditorTheme,
  PreviewThemeName,
  RecentFile,
  SessionSnapshot,
  SupportedLanguage
} from '@/types/editor';

const INITIAL_CONTENT = [
  '# MD Code',
  '',
  '以 **Monaco Editor** 为编辑核心，Markdown 作为重点增强文档类型。',
  '',
  '## 编辑器能力',
  '',
  '- Monaco 多光标、撤销重做、搜索替换与语法高亮',
  '- Markdown / JSON / HTML / CSS / JavaScript / TypeScript / YAML / XML',
  '- Markdown 默认阅读模式，可切换分栏或仅编辑',
  '- 多文档 Tab、最近文件与自动恢复',
  '',
  '## 代码高亮',
  '',
  '```typescript',
  'interface DocumentTab {',
  '  id: string;',
  '  filename: string;',
  '  language: string;',
  '  modified: boolean;',
  '}',
  '```',
  '',
  '> 使用顶部工具栏选择预览主题和代码风格。',
  ''
].join('\n');

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `document-${Date.now()}-${Math.random()}`;
}

function filenameFromPath(path: string): string {
  return path.split(/[\\/]/u).pop() || 'Untitled.txt';
}

function defaultCursor(): CursorPosition {
  return { lineNumber: 1, column: 1 };
}

function createUntitled(index: number, content = ''): EditorDocument {
  const filename = index === 1 ? 'Untitled.md' : `Untitled-${index}.md`;
  return {
    id: createId(),
    path: null,
    filename,
    language: 'markdown',
    content,
    modified: false,
    mode: 'preview',
    cursor: defaultCursor()
  };
}

export const useEditorStore = defineStore('editor', () => {
  const initialDocument = createUntitled(1, INITIAL_CONTENT);
  const documents = ref<EditorDocument[]>([initialDocument]);
  const activeDocumentId = ref(initialDocument.id);
  const savedContents = ref<Record<string, string>>({ [initialDocument.id]: INITIAL_CONTENT });
  const recentFiles = ref<RecentFile[]>([]);
  const theme = ref<EditorTheme>('light');
  const previewTheme = ref<PreviewThemeName>('default');
  const codeTheme = ref<CodeThemeName>('github');

  const activeDocument = computed(
    () => documents.value.find((item) => item.id === activeDocumentId.value) ?? documents.value[0]
  );
  const title = computed(() => {
    const document = activeDocument.value;
    if (!document) return 'MD Code';
    return document.modified ? `${document.filename} *` : document.filename;
  });
  const hasModifiedDocuments = computed(() => documents.value.some((item) => item.modified));

  function activateDocument(id: string): void {
    if (documents.value.some((item) => item.id === id)) activeDocumentId.value = id;
  }

  function createDocument(language: SupportedLanguage = 'markdown'): string {
    const untitledCount = documents.value.filter((item) => item.path === null).length + 1;
    const document = createUntitled(untitledCount);
    document.language = language;
    document.mode = defaultModeForLanguage(language);
    const activeIndex = documents.value.findIndex((item) => item.id === activeDocumentId.value);
    const insertIndex = activeIndex >= 0 ? activeIndex + 1 : documents.value.length;
    documents.value.splice(insertIndex, 0, document);
    savedContents.value[document.id] = '';
    activeDocumentId.value = document.id;
    return document.id;
  }

  function addDocument(input: {
    path: string | null;
    filename: string;
    content: string;
    language?: SupportedLanguage;
  }): string {
    if (input.path) {
      const normalized = input.path.toLocaleLowerCase();
      const existing = documents.value.find(
        (item) => item.path?.toLocaleLowerCase() === normalized
      );
      if (existing) {
        activeDocumentId.value = existing.id;
        return existing.id;
      }
    }

    const language = input.language ?? detectLanguage(input.filename);
    const document: EditorDocument = {
      id: createId(),
      path: input.path,
      filename: input.filename,
      language,
      content: input.content,
      modified: false,
      mode: defaultModeForLanguage(language),
      cursor: defaultCursor()
    };
    documents.value.push(document);
    savedContents.value[document.id] = input.content;
    activeDocumentId.value = document.id;
    return document.id;
  }

  function updateContent(id: string, content: string): void {
    const document = documents.value.find((item) => item.id === id);
    if (!document || content === document.content) return;
    document.content = content;
    document.modified = content !== (savedContents.value[id] ?? '');
  }

  function applyExternalContent(id: string, content: string, diskContent: string): void {
    const document = documents.value.find((item) => item.id === id);
    if (!document) return;
    savedContents.value[id] = diskContent;
    document.content = content;
    document.modified = content !== diskContent;
  }

  function updateCursor(id: string, cursor: CursorPosition): void {
    const document = documents.value.find((item) => item.id === id);
    if (document) document.cursor = cursor;
  }

  function setMode(id: string, mode: EditorMode): void {
    const document = documents.value.find((item) => item.id === id);
    if (document) document.mode = mode;
  }

  function setLanguage(id: string, language: SupportedLanguage): void {
    const document = documents.value.find((item) => item.id === id);
    if (!document) return;
    document.language = language;
    document.mode = defaultModeForLanguage(language);
  }

  function markSaved(id: string, path?: string | null): void {
    const document = documents.value.find((item) => item.id === id);
    if (!document) return;
    const previousPath = document.path;
    if (path !== undefined) {
      document.path = path;
      if (path) {
        document.filename = filenameFromPath(path);
        document.language = detectLanguage(document.filename);
      }
    }
    savedContents.value[id] = document.content;
    document.modified = false;
    if (document.path && previousPath?.toLocaleLowerCase() !== document.path.toLocaleLowerCase()) {
      recordRecent(document.path, document.filename);
    }
  }

  function renameDocument(id: string, filename: string, path?: string | null): void {
    const document = documents.value.find((item) => item.id === id);
    if (!document) return;

    const previousPath = document.path;
    const previousLanguage = document.language;
    document.filename = filename;
    if (path !== undefined) document.path = path;
    document.language = detectLanguage(filename);
    if (document.language !== previousLanguage) {
      document.mode = defaultModeForLanguage(document.language);
    }

    if (
      previousPath &&
      document.path &&
      previousPath.toLocaleLowerCase() !== document.path.toLocaleLowerCase()
    ) {
      removeRecent(previousPath);
      recordRecent(document.path, filename);
    }
  }

  function closeDocument(id: string): void {
    const index = documents.value.findIndex((item) => item.id === id);
    if (index === -1) return;
    documents.value.splice(index, 1);
    delete savedContents.value[id];

    if (documents.value.length === 0) {
      createDocument();
      return;
    }
    if (activeDocumentId.value === id) {
      activeDocumentId.value = documents.value[Math.min(index, documents.value.length - 1)].id;
    }
  }

  function cycleDocument(direction = 1): void {
    if (documents.value.length < 2) return;
    const current = documents.value.findIndex((item) => item.id === activeDocumentId.value);
    const next = (current + direction + documents.value.length) % documents.value.length;
    activeDocumentId.value = documents.value[next].id;
  }

  function reorderDocument(documentId: string, oldIndex: number, newIndex: number): void {
    const sourceIndex =
      documents.value[oldIndex]?.id === documentId
        ? oldIndex
        : documents.value.findIndex((document) => document.id === documentId);
    if (
      sourceIndex === newIndex ||
      sourceIndex < 0 ||
      newIndex < 0 ||
      newIndex >= documents.value.length
    ) {
      return;
    }
    const [document] = documents.value.splice(sourceIndex, 1);
    documents.value.splice(newIndex, 0, document);
  }

  function recordRecent(path: string, filename = filenameFromPath(path)): void {
    const normalized = path.toLocaleLowerCase();
    const existing = recentFiles.value.find((item) => item.path.toLocaleLowerCase() === normalized);
    if (existing) {
      existing.filename = filename;
      existing.lastOpenTime = Date.now();
      existing.count += 1;
    } else {
      recentFiles.value.push({ path, filename, lastOpenTime: Date.now(), count: 1 });
    }
    recentFiles.value.sort((left, right) => right.lastOpenTime - left.lastOpenTime);
    recentFiles.value = recentFiles.value.slice(0, 30);
  }

  function removeRecent(path: string): void {
    const normalized = path.toLocaleLowerCase();
    recentFiles.value = recentFiles.value.filter(
      (item) => item.path.toLocaleLowerCase() !== normalized
    );
  }

  function clearRecent(): void {
    recentFiles.value = [];
  }

  function setTheme(value: EditorTheme): void {
    theme.value = value;
  }

  function toggleTheme(): void {
    theme.value = theme.value === 'light' ? 'dark' : theme.value === 'dark' ? 'system' : 'light';
  }

  function setPreviewTheme(value: PreviewThemeName): void {
    previewTheme.value = value;
  }

  function setCodeTheme(value: CodeThemeName): void {
    codeTheme.value = value;
  }

  function createSnapshot(): SessionSnapshot {
    return {
      version: 2,
      documents: documents.value,
      activeDocumentId: activeDocumentId.value,
      savedContents: savedContents.value,
      recentFiles: recentFiles.value,
      theme: theme.value,
      previewTheme: previewTheme.value,
      codeTheme: codeTheme.value
    };
  }

  function restoreSnapshot(
    snapshot: Partial<SessionSnapshot> & { documents?: Array<Partial<EditorDocument>> }
  ): void {
    const restoredDocuments = (snapshot.documents ?? []).map((item, index): EditorDocument => {
      const filename = item.filename ?? `Untitled-${index + 1}.md`;
      const detectedLanguage = detectLanguage(filename);
      const language =
        !item.language || (item.language === 'plaintext' && detectedLanguage !== 'plaintext')
          ? detectedLanguage
          : item.language;
      return {
        id: item.id ?? createId(),
        path: item.path ?? null,
        filename,
        language,
        content: item.content ?? '',
        modified: item.modified ?? false,
        mode:
          item.mode === 'preview' || item.mode === 'split' || item.mode === 'editor'
            ? item.mode
            : defaultModeForLanguage(language),
        cursor: item.cursor ?? defaultCursor()
      };
    });

    if (restoredDocuments.length === 0) return;
    documents.value = restoredDocuments;
    savedContents.value =
      snapshot.savedContents ??
      Object.fromEntries(restoredDocuments.map((item) => [item.id, item.modified ? '' : item.content]));
    recentFiles.value = snapshot.recentFiles ?? [];
    theme.value = snapshot.theme ?? 'light';
    previewTheme.value = snapshot.previewTheme ?? 'default';
    codeTheme.value = snapshot.codeTheme ?? 'github';
    activeDocumentId.value = restoredDocuments.some((item) => item.id === snapshot.activeDocumentId)
      ? snapshot.activeDocumentId!
      : restoredDocuments[0].id;
  }

  return {
    documents,
    activeDocumentId,
    activeDocument,
    savedContents,
    recentFiles,
    theme,
    previewTheme,
    codeTheme,
    title,
    hasModifiedDocuments,
    activateDocument,
    createDocument,
    addDocument,
    updateContent,
    applyExternalContent,
    updateCursor,
    setMode,
    setLanguage,
    markSaved,
    renameDocument,
    closeDocument,
    cycleDocument,
    reorderDocument,
    recordRecent,
    removeRecent,
    clearRecent,
    setTheme,
    toggleTheme,
    setPreviewTheme,
    setCodeTheme,
    createSnapshot,
    restoreSnapshot
  };
});
