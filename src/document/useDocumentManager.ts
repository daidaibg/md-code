import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  copyTextToClipboard,
  openTextFiles,
  readTextFile,
  renameTextFile,
  revealInFileManager,
  saveTextFile,
  showDesktopMessage
} from '@/filesystem/fileSystemService';
import { disposeDocumentModel } from '@/editor/monaco/modelRegistry';
import {
  createFileWatcher,
  type FileSystemChange,
  type FileWatcherController
} from '@/document/fileWatcher';
import { useEditorStore } from '@/store/editor';
import { useSettingsStore } from '@/store/settings';
import type { ExternalFileConflict } from '@/types/editor';

export type UnsavedDecision = 'save' | 'discard' | 'cancel';

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizedPath(path: string): string {
  return path.replaceAll('/', '\\').toLocaleLowerCase();
}

function parentDirectory(path: string): string | null {
  const index = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'));
  return index > 0 ? path.slice(0, index) : null;
}

export function useDocumentManager() {
  const store = useEditorStore();
  const settingsStore = useSettingsStore();
  const busy = ref(false);
  const errorMessage = ref<string | null>(null);
  const pendingCloseId = ref<string | null>(null);
  const pendingCloseIds = ref<string[]>([]);
  const pendingCloseAll = ref(false);
  const pendingRenameId = ref<string | null>(null);
  const externalConflicts = ref<ExternalFileConflict[]>([]);
  const externalDiffOpen = ref(false);
  const workspaceChangeVersion = ref(0);
  const ignoredDiskContents = new Map<string, string>();
  let fileWatcher: FileWatcherController | undefined;
  let closeAllCompletion: (() => void | Promise<void>) | null = null;

  const pendingCloseDocument = computed(
    () => store.documents.find((item) => item.id === pendingCloseId.value) ?? null
  );
  const pendingRenameDocument = computed(
    () => store.documents.find((item) => item.id === pendingRenameId.value) ?? null
  );
  const externalConflict = computed(() => externalConflicts.value[0] ?? null);
  const workspaceDirectory = computed(() =>
    store.activeDocument?.path ? parentDirectory(store.activeDocument.path) : null
  );

  function removeExternalConflict(documentId: string): void {
    externalConflicts.value = externalConflicts.value.filter(
      (conflict) => conflict.documentId !== documentId
    );
    externalDiffOpen.value = false;
  }

  function enqueueExternalConflict(conflict: ExternalFileConflict): void {
    const index = externalConflicts.value.findIndex(
      (item) => item.documentId === conflict.documentId
    );
    if (index >= 0) externalConflicts.value[index] = conflict;
    else externalConflicts.value.push(conflict);
  }

  async function handleExternalFileChange(change: FileSystemChange): Promise<void> {
    workspaceChangeVersion.value += 1;
    const changedPaths = new Map(
      change.paths.map((path) => [normalizedPath(path), path] as const)
    );

    for (const document of [...store.documents]) {
      if (!document.path) continue;
      const changedPath = changedPaths.get(normalizedPath(document.path));
      if (!changedPath) continue;

      let diskContent = '';
      let diskAvailable = true;
      try {
        diskContent = (await readTextFile(changedPath)).content;
      } catch {
        diskAvailable = false;
      }

      const current = store.documents.find((item) => item.id === document.id);
      if (!current?.path) continue;
      if (diskAvailable && diskContent === current.content) {
        ignoredDiskContents.delete(current.id);
        continue;
      }
      if (diskAvailable && ignoredDiskContents.get(current.id) === diskContent) continue;

      if (!current.modified && diskAvailable) {
        store.applyExternalContent(current.id, diskContent, diskContent);
        removeExternalConflict(current.id);
        continue;
      }
      if (
        diskAvailable &&
        diskContent === (store.savedContents[current.id] ?? '') &&
        current.modified
      ) {
        continue;
      }

      enqueueExternalConflict({
        documentId: current.id,
        path: current.path,
        filename: current.filename,
        localContent: current.content,
        localModified: current.modified,
        diskContent,
        diskAvailable,
        changeKind: change.kind,
        detectedAt: Date.now()
      });
    }
  }

  async function syncFileWatcher(): Promise<void> {
    if (!fileWatcher) return;
    try {
      await fileWatcher.sync(
        store.documents.flatMap((document) => (document.path ? [document.path] : [])),
        workspaceDirectory.value
      );
    } catch (error) {
      errorMessage.value = `文件监听失败：${errorText(error)}`;
    }
  }

  function showExternalDiff(): void {
    if (externalConflict.value?.diskAvailable) externalDiffOpen.value = true;
  }

  function keepCurrentExternalVersion(): void {
    const conflict = externalConflict.value;
    if (!conflict) return;
    if (conflict.diskAvailable) {
      ignoredDiskContents.set(conflict.documentId, conflict.diskContent);
      store.applyExternalContent(
        conflict.documentId,
        conflict.localContent,
        conflict.diskContent
      );
    }
    removeExternalConflict(conflict.documentId);
  }

  function reloadExternalDiskVersion(): void {
    const conflict = externalConflict.value;
    if (!conflict?.diskAvailable) return;
    ignoredDiskContents.delete(conflict.documentId);
    store.applyExternalContent(
      conflict.documentId,
      conflict.diskContent,
      conflict.diskContent
    );
    removeExternalConflict(conflict.documentId);
  }

  function applyExternalMergedContent(content: string): void {
    const conflict = externalConflict.value;
    if (!conflict?.diskAvailable) return;
    ignoredDiskContents.set(conflict.documentId, conflict.diskContent);
    store.applyExternalContent(conflict.documentId, content, conflict.diskContent);
    removeExternalConflict(conflict.documentId);
  }

  function closeExternalDiff(): void {
    externalDiffOpen.value = false;
  }

  async function run(task: () => Promise<void>, fallback: string): Promise<void> {
    if (busy.value) return;
    busy.value = true;
    errorMessage.value = null;
    try {
      await task();
    } catch (error) {
      errorMessage.value = errorText(error);
      await showDesktopMessage(`${fallback}：${errorMessage.value}`);
    } finally {
      busy.value = false;
    }
  }

  function closeDocument(id: string): void {
    disposeDocumentModel(id);
    ignoredDiskContents.delete(id);
    removeExternalConflict(id);
    store.closeDocument(id);
  }

  function newDocument(): void {
    store.createDocument();
  }

  async function openDocuments(): Promise<void> {
    await run(async () => {
      const files = await openTextFiles();
      for (const file of files) {
        store.addDocument(file);
        if (file.path) store.recordRecent(file.path, file.filename);
      }
    }, '打开文件失败');
  }

  async function openPath(path: string): Promise<void> {
    await run(async () => {
      const file = await readTextFile(path);
      store.addDocument(file);
      store.recordRecent(path, file.filename);
    }, '打开文件失败');
  }

  async function openRecent(path: string): Promise<void> {
    await openPath(path);
  }

  async function saveDocument(id: string, saveAs = false): Promise<boolean> {
    const document = store.documents.find((item) => item.id === id);
    if (!document) return false;

    let saved = false;
    await run(async () => {
      const result = await saveTextFile({
        path: document.path,
        filename: document.filename,
        content: document.content,
        saveAs,
        defaultDirectory: document.path ? undefined : settingsStore.newFileDirectory
      });
      if (!result.saved) return;
      store.markSaved(id, result.path);
      saved = true;
    }, '保存文件失败');
    return saved;
  }

  async function saveActive(saveAs = false): Promise<boolean> {
    return store.activeDocument ? saveDocument(store.activeDocument.id, saveAs) : false;
  }

  async function revealDocument(id: string): Promise<void> {
    const document = store.documents.find((item) => item.id === id);
    if (!document?.path) return;
    await run(() => revealInFileManager(document.path!), '打开文件资源管理器失败');
  }

  async function copyDocumentPath(id: string): Promise<void> {
    const document = store.documents.find((item) => item.id === id);
    if (!document?.path) return;
    await run(() => copyTextToClipboard(document.path!), '复制文件路径失败');
  }

  function requestRename(id: string): void {
    if (!store.documents.some((document) => document.id === id)) return;
    errorMessage.value = null;
    store.activateDocument(id);
    pendingRenameId.value = id;
  }

  function cancelRename(): void {
    pendingRenameId.value = null;
  }

  async function renameDocument(newFilename: string): Promise<void> {
    const id = pendingRenameId.value;
    const document = store.documents.find((item) => item.id === id);
    if (!id || !document || busy.value) return;

    const filename = newFilename.trim();
    if (!filename || filename === document.filename) {
      cancelRename();
      return;
    }

    busy.value = true;
    errorMessage.value = null;
    try {
      const renamedPath = document.path
        ? await renameTextFile(document.path, filename)
        : document.path;
      store.renameDocument(id, filename, renamedPath);
      ignoredDiskContents.delete(id);
      removeExternalConflict(id);
      pendingRenameId.value = null;
      await syncFileWatcher();
    } catch (error) {
      errorMessage.value = `重命名失败：${errorText(error)}`;
    } finally {
      busy.value = false;
    }
  }

  function resetPendingCloseState(): void {
    pendingCloseId.value = null;
    pendingCloseIds.value = [];
    pendingCloseAll.value = false;
    closeAllCompletion = null;
  }

  async function continuePendingClose(): Promise<void> {
    while (pendingCloseIds.value.length > 0) {
      const id = pendingCloseIds.value[0];
      const document = store.documents.find((item) => item.id === id);
      if (!document) {
        pendingCloseIds.value.shift();
        continue;
      }
      if (document.modified) {
        pendingCloseId.value = id;
        return;
      }

      pendingCloseIds.value.shift();
      closeDocument(id);
    }

    const completion = pendingCloseAll.value ? closeAllCompletion : null;
    resetPendingCloseState();
    if (completion) await completion();
  }

  function requestCloseDocuments(ids: string[]): void {
    const existingIds = new Set(store.documents.map((document) => document.id));
    pendingCloseAll.value = false;
    closeAllCompletion = null;
    pendingCloseId.value = null;
    pendingCloseIds.value = [...new Set(ids)].filter((id) => existingIds.has(id));
    void continuePendingClose();
  }

  function requestClose(id: string): void {
    requestCloseDocuments([id]);
  }

  function requestCloseOthers(id: string): void {
    requestCloseDocuments(
      store.documents.filter((document) => document.id !== id).map((document) => document.id)
    );
  }

  function requestCloseLeft(id: string): void {
    const index = store.documents.findIndex((document) => document.id === id);
    if (index > 0) {
      requestCloseDocuments(store.documents.slice(0, index).map((document) => document.id));
    }
  }

  function requestCloseRight(id: string): void {
    const index = store.documents.findIndex((document) => document.id === id);
    if (index >= 0) {
      requestCloseDocuments(
        store.documents.slice(index + 1).map((document) => document.id)
      );
    }
  }

  function requestCloseAll(completion: () => void | Promise<void>): boolean {
    const modifiedIds = store.documents.filter((item) => item.modified).map((item) => item.id);
    if (modifiedIds.length === 0) return false;
    pendingCloseAll.value = true;
    pendingCloseIds.value = modifiedIds;
    pendingCloseId.value = null;
    closeAllCompletion = completion;
    void continuePendingClose();
    return true;
  }

  function cancelPendingClose(): void {
    resetPendingCloseState();
  }

  async function resolvePendingClose(decision: UnsavedDecision): Promise<void> {
    const id = pendingCloseId.value;
    if (!id || decision === 'cancel') {
      cancelPendingClose();
      return;
    }
    if (decision === 'save' && !(await saveDocument(id))) return;

    pendingCloseId.value = null;
    if (pendingCloseIds.value[0] === id) pendingCloseIds.value.shift();
    else pendingCloseIds.value = pendingCloseIds.value.filter((item) => item !== id);
    closeDocument(id);
    await continuePendingClose();
  }

  function removeRecent(path: string): void {
    store.removeRecent(path);
  }

  function dismissError(): void {
    errorMessage.value = null;
  }

  watch(
    [
      () => store.documents.map((document) => document.path),
      () => store.activeDocumentId
    ],
    () => void syncFileWatcher(),
    { deep: true }
  );

  onMounted(() => {
    void (async () => {
      try {
        fileWatcher = await createFileWatcher(handleExternalFileChange);
        await syncFileWatcher();
      } catch (error) {
        errorMessage.value = `启动文件监听失败：${errorText(error)}`;
      }
    })();
  });

  onBeforeUnmount(() => {
    fileWatcher?.dispose();
    fileWatcher = undefined;
  });

  return {
    busy,
    errorMessage,
    pendingCloseDocument,
    pendingCloseAll,
    pendingRenameDocument,
    externalConflict,
    externalDiffOpen,
    workspaceChangeVersion,
    newDocument,
    openDocuments,
    openPath,
    openRecent,
    saveDocument,
    saveActive,
    revealDocument,
    copyDocumentPath,
    requestRename,
    cancelRename,
    renameDocument,
    requestClose,
    requestCloseOthers,
    requestCloseLeft,
    requestCloseRight,
    requestCloseAll,
    resolvePendingClose,
    showExternalDiff,
    keepCurrentExternalVersion,
    reloadExternalDiskVersion,
    applyExternalMergedContent,
    closeExternalDiff,
    removeRecent,
    dismissError
  };
}
