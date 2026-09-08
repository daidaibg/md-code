<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import AppMenuBar from '@/app/components/AppMenuBar.vue';
import StatusBar from '@/app/components/StatusBar.vue';
import UnsavedChangesDialog from '@/document/components/UnsavedChangesDialog.vue';
import RenameDocumentDialog from '@/document/components/RenameDocumentDialog.vue';
import ExternalFileConflictDialog from '@/document/components/ExternalFileConflictDialog.vue';
import { useDocumentManager } from '@/document/useDocumentManager';
import { useDesktopWindow } from '@/app/useDesktopWindow';
import DocumentEditor from '@/editor/components/DocumentEditor.vue';
import SettingsPage from '@/settings/components/SettingsPage.vue';
import NotePanel from '@/notes/components/NotePanel.vue';
import { openDetachedNotesWindow } from '@/notes/noteService';
import packageMetadata from '../../package.json';
import { supportsPreview } from '@/editor/language/languageManager';
import { useEditorStore } from '@/store/editor';
import { useSettingsStore } from '@/store/settings';
import DocumentTabs from '@/tabs/components/DocumentTabs.vue';
import { useResolvedTheme } from '@/themes/useResolvedTheme';
import { useApplicationUpdater } from '@/update/useApplicationUpdater';
import type { EditorMode, SupportedLanguage, TextSelection } from '@/types/editor';

interface DocumentEditorApi {
  focus: () => Promise<void>;
  focusSelection: (selection: TextSelection) => Promise<void>;
  showFind: (replace?: boolean) => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  selectAll: () => Promise<void>;
  formatDocument: () => Promise<void>;
}

interface NotePanelApi extends DocumentEditorApi {
  flushPendingSave: () => Promise<void>;
  currentMode: EditorMode;
  setMode: (mode: EditorMode) => void;
}

interface WorkspaceTabTarget { kind: 'document' | 'settings' | 'notes'; id?: string }
type WorkspaceTabCloseScope = 'current' | 'others' | 'left' | 'right';

const editorStore = useEditorStore();
const settingsStore = useSettingsStore();
const route = useRoute();
const router = useRouter();
const {
  documents,
  activeDocumentId,
  activeDocument,
  recentFiles,
  theme,
  previewTheme,
  codeTheme,
  title
} = storeToRefs(editorStore);
const resolvedTheme = useResolvedTheme(theme);
const { monaco } = storeToRefs(settingsStore);
const documentManager = useDocumentManager();
const applicationUpdater = useApplicationUpdater();
const documentEditor = ref<DocumentEditorApi>();
const notePanel = ref<NotePanelApi>();
const settingsOpen = ref(route.name === 'settings');
const notesOpen = ref(route.name === 'notes');
const settingsSection = ref(
  typeof route.params.section === 'string' ? route.params.section : 'appearance'
);
const activeWorkspace = ref<'document' | 'settings' | 'notes'>(
  route.name === 'settings' ? 'settings' : route.name === 'notes' ? 'notes' : 'document'
);
const recoveryEnabled = typeof window !== 'undefined' && 'localStorage' in window;
const previewSupported = computed(() => activeWorkspace.value === 'notes' || (
  activeDocument.value ? supportsPreview(activeDocument.value.language) : false
));
const activeMode = computed<EditorMode>(() =>
  activeWorkspace.value === 'notes'
    ? notePanel.value?.currentMode ?? 'editor'
    : activeDocument.value?.mode ?? 'editor'
);
const activeLanguage = computed<SupportedLanguage>(() =>
  activeWorkspace.value === 'notes' ? 'markdown' : activeDocument.value?.language ?? 'plaintext'
);
const externalConflictLanguage = computed<SupportedLanguage>(() => {
  const conflict = documentManager.externalConflict.value;
  return (
    documents.value.find((document) => document.id === conflict?.documentId)?.language ??
    'plaintext'
  );
});
let updateCheckTimer = 0;

useDesktopWindow({
  shouldPersistWindowState: () => settingsStore.rememberWindowState,
  hasModifiedDocuments: () => editorStore.hasModifiedDocuments,
  isCloseConfirmationPending: () => documentManager.pendingCloseAll.value,
  requestCloseAll: documentManager.requestCloseAll,
  openPath: async (path) => {
    await documentManager.openPath(path);
    activeWorkspace.value = 'document';
    await router.push({ name: 'editor' });
  },
  openNotes: toggleNotes,
  openSettings
});

function updateActiveContent(content: string): void {
  if (activeDocument.value) editorStore.updateContent(activeDocument.value.id, content);
}

function updateActiveMode(mode: EditorMode): void {
  if (activeWorkspace.value === 'notes') notePanel.value?.setMode(mode);
  else if (activeDocument.value) editorStore.setMode(activeDocument.value.id, mode);
}

function closeActiveDocument(): void {
  if (activeDocument.value) documentManager.requestClose(activeDocument.value.id);
}

function closeActiveWorkspace(): void {
  if (activeWorkspace.value === 'settings') closeSettings();
  else if (activeWorkspace.value === 'notes') closeNotes();
  else closeActiveDocument();
}

function activeEditorApi(): DocumentEditorApi | undefined {
  return activeWorkspace.value === 'notes' ? notePanel.value : documentEditor.value;
}

function saveActiveWorkspace(saveAs = false): void {
  if (activeWorkspace.value === 'notes') void notePanel.value?.flushPendingSave();
  else void documentManager.saveActive(saveAs);
}

function cycleDocument(direction: number): void {
  editorStore.cycleDocument(direction);
  activeWorkspace.value = 'document';
  void router.push({ name: 'editor' });
}

function activateDocument(id: string): void {
  editorStore.activateDocument(id);
  activeWorkspace.value = 'document';
  void router.push({ name: 'editor' });
}

function newDocument(): void {
  documentManager.newDocument();
  activeWorkspace.value = 'document';
  void router.push({ name: 'editor' });
}

async function openDocuments(): Promise<void> {
  await documentManager.openDocuments();
  activeWorkspace.value = 'document';
  void router.push({ name: 'editor' });
}

async function openRecent(path: string): Promise<void> {
  await documentManager.openRecent(path);
  activeWorkspace.value = 'document';
  void router.push({ name: 'editor' });
}

function openSettings(): void {
  settingsOpen.value = true;
  activeWorkspace.value = 'settings';
  void router.push({ name: 'settings', params: { section: settingsSection.value } });
}

function closeSettings(): void {
  settingsOpen.value = false;
  if (activeWorkspace.value === 'settings') {
    activeWorkspace.value = 'document';
    void router.push({ name: 'editor' });
  }
}

function openNotesSettings(): void {
  settingsOpen.value = true;
  settingsSection.value = 'notes';
  activeWorkspace.value = 'settings';
  void router.push({ name: 'settings', params: { section: 'notes' } });
}

function toggleNotes(): void {
  notesOpen.value = true;
  activeWorkspace.value = 'notes';
  void router.push({ name: 'notes' });
}

function closeNotes(): void {
  notesOpen.value = false;
  if (activeWorkspace.value === 'notes') {
    activeWorkspace.value = 'document';
    void router.push({ name: 'editor' });
  }
}

function closeTabScope(target: WorkspaceTabTarget, scope: WorkspaceTabCloseScope): void {
  const tabs: WorkspaceTabTarget[] = [
    ...documents.value.map(document => ({ kind: 'document' as const, id: document.id })),
    ...(settingsOpen.value ? [{ kind: 'settings' as const }] : []),
    ...(notesOpen.value ? [{ kind: 'notes' as const }] : [])
  ];
  const targetIndex = tabs.findIndex(tab => tab.kind === target.kind && tab.id === target.id);
  if (targetIndex < 0) return;

  const selected = scope === 'current'
    ? [tabs[targetIndex]]
    : scope === 'others'
      ? tabs.filter((_, index) => index !== targetIndex)
      : scope === 'left'
        ? tabs.slice(0, targetIndex)
        : tabs.slice(targetIndex + 1);
  const documentIds = selected
    .filter((tab): tab is { kind: 'document'; id: string } => tab.kind === 'document' && Boolean(tab.id))
    .map(tab => tab.id);

  documentManager.requestCloseDocuments(documentIds, () => {
    if (selected.some(tab => tab.kind === 'settings')) closeSettings();
    if (selected.some(tab => tab.kind === 'notes')) closeNotes();
  });
}

function installUpdate(): void {
  const install = () => applicationUpdater.installAndRestart();
  if (!documentManager.requestCloseAll(install)) void install();
}

function checkForUpdates(): void {
  void applicationUpdater.checkAndDownload(true);
}

function onGlobalKeydown(event: KeyboardEvent): void {
  if (documentManager.externalConflict.value) {
    if (event.key === 'Escape' && documentManager.externalDiffOpen.value) {
      event.preventDefault();
      documentManager.closeExternalDiff();
      return;
    }
    if (event.ctrlKey || event.metaKey) {
      const conflictKey = event.key.toLocaleLowerCase();
      if (['n', 'o', 's', 'w', 'tab'].includes(conflictKey)) event.preventDefault();
    }
    return;
  }
  if (event.key === 'Escape' && activeWorkspace.value === 'settings') {
    closeSettings();
    return;
  }
  if (!(event.ctrlKey || event.metaKey)) return;
  const key = event.key.toLocaleLowerCase();

  if (event.altKey && key === 'n') {
    event.preventDefault();
    toggleNotes();
    return;
  }

  if (key === 'n') {
    event.preventDefault();
    newDocument();
  } else if (key === 'o') {
    event.preventDefault();
    void openDocuments();
  } else if (key === 's') {
    event.preventDefault();
    saveActiveWorkspace(event.shiftKey);
  } else if (key === 'f') {
    event.preventDefault();
    void activeEditorApi()?.showFind(false);
  } else if (key === 'h') {
    event.preventDefault();
    void activeEditorApi()?.showFind(true);
  } else if (key === 'tab') {
    event.preventDefault();
    cycleDocument(event.shiftKey ? -1 : 1);
  } else if (key === 'w') {
    event.preventDefault();
    if (activeWorkspace.value === 'settings') closeSettings();
    else if (activeWorkspace.value === 'notes') closeNotes();
    else closeActiveDocument();
  }
}

watch(
  () => [route.name, route.params.section] as const,
  ([name, section]) => {
    if (name === 'settings') {
      settingsOpen.value = true;
      activeWorkspace.value = 'settings';
    } else if (name === 'notes') {
      notesOpen.value = true;
      activeWorkspace.value = 'notes';
    } else if (name === 'editor') {
      activeWorkspace.value = 'document';
    }
    if (name === 'settings' && typeof section === 'string') {
      settingsSection.value = section;
    }
  },
  { immediate: true }
);

watch(
  [title, activeWorkspace],
  ([value, workspace]) => {
    document.title = workspace === 'settings'
      ? '设置 — MD Code'
      : workspace === 'notes'
        ? '便签 — MD Code'
        : value === 'MD Code'
        ? value
        : `${value} — MD Code`;
  },
  { immediate: true }
);

function onBeforeUnload(event: BeforeUnloadEvent): void {
  if (!editorStore.hasModifiedDocuments) return;
  event.preventDefault();
  event.returnValue = '';
}

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeydown);
  window.addEventListener('beforeunload', onBeforeUnload);
  if (import.meta.env.PROD) {
    updateCheckTimer = window.setTimeout(
      () => void applicationUpdater.checkAndDownload(),
      1_500
    );
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeydown);
  window.removeEventListener('beforeunload', onBeforeUnload);
  window.clearTimeout(updateCheckTimer);
});
</script>

<template>
  <main class="app-shell" :data-theme="resolvedTheme">
    <AppMenuBar
      :title="title"
      :theme="theme"
      :busy="documentManager.busy.value"
      :mode="activeMode"
      :language="activeLanguage"
      :preview-supported="previewSupported"
      :recent-files="recentFiles"
      :app-version="packageMetadata.version"
      :update-status="applicationUpdater.status.value"
      :update-version="applicationUpdater.version.value"
      :update-progress="applicationUpdater.progress.value"
      :manual-check-visible="applicationUpdater.manualCheckVisible.value"
      @new="newDocument"
      @open="openDocuments"
      @save="saveActiveWorkspace()"
      @save-as="saveActiveWorkspace(true)"
      @close="closeActiveWorkspace"
      @undo="activeEditorApi()?.undo()"
      @redo="activeEditorApi()?.redo()"
      @search="activeEditorApi()?.showFind(false)"
      @replace="activeEditorApi()?.showFind(true)"
      @select-all="activeEditorApi()?.selectAll()"
      @format="activeEditorApi()?.formatDocument()"
      @open-recent="openRecent"
      @clear-recent="editorStore.clearRecent"
      @set-mode="updateActiveMode"
      @cycle-tab="cycleDocument"
      @set-theme="editorStore.setTheme"
      @open-settings="openSettings"
      @toggle-notes="toggleNotes"
      @install-update="installUpdate"
      @check-update="checkForUpdates"
    />

    <DocumentTabs
      :documents="documents"
      :active-id="activeDocumentId"
      :busy="documentManager.busy.value"
      :active-workspace="activeWorkspace"
      :settings-open="settingsOpen"
      :notes-open="notesOpen"
      @new="newDocument"
      @reorder="editorStore.reorderDocument"
      @activate="activateDocument"
      @activate-settings="openSettings"
      @activate-notes="toggleNotes"
      @close-settings="closeSettings"
      @close-notes="closeNotes"
      @detach-notes="openDetachedNotesWindow"
      @close-tab-scope="closeTabScope"
      @save="documentManager.saveDocument"
      @save-as="documentManager.saveDocument($event, true)"
      @reveal="documentManager.revealDocument"
      @copy-path="documentManager.copyDocumentPath"
      @rename="documentManager.requestRename"
      @close="documentManager.requestClose"
      @close-others="documentManager.requestCloseOthers"
      @close-left="documentManager.requestCloseLeft"
      @close-right="documentManager.requestCloseRight"
    />

    <div class="application-workspace">
      <!-- Visibility belongs to a real element: child components may have fragment roots. -->
      <div
        v-if="settingsOpen"
        v-show="activeWorkspace === 'settings'"
        class="workspace-page"
      >
        <SettingsPage @close="closeSettings" />
      </div>
      <div
        v-if="notesOpen"
        v-show="activeWorkspace === 'notes'"
        class="workspace-page"
      >
      <NotePanel
        ref="notePanel"
        :directory="settingsStore.notesDirectory"
        :theme="resolvedTheme"
        :preview-theme="previewTheme"
        :code-theme="codeTheme"
        :editor-settings="monaco"
        @close="closeNotes"
        @settings="openNotesSettings"
        @detach="openDetachedNotesWindow"
        @update:preview-theme="editorStore.setPreviewTheme"
        @update:code-theme="editorStore.setCodeTheme"
      />
      </div>
      <div
        v-if="activeDocument"
        v-show="activeWorkspace === 'document'"
        class="workspace-page"
      >
      <DocumentEditor
        :key="activeDocument.id"
        ref="documentEditor"
        :document="activeDocument"
        :theme="resolvedTheme"
        :preview-theme="previewTheme"
        :code-theme="codeTheme"
        :editor-settings="monaco"
        @update:content="updateActiveContent"
        @update:mode="updateActiveMode"
        @update:cursor="editorStore.updateCursor(activeDocument.id, $event)"
        @update:preview-theme="editorStore.setPreviewTheme"
        @update:code-theme="editorStore.setCodeTheme"
      />
      </div>
      <div v-if="!activeDocument && activeWorkspace === 'document'" class="empty-workspace">没有打开的文档</div>
    </div>

    <StatusBar
      :document="activeDocument"
      :document-count="documents.length"
      :recovery-enabled="recoveryEnabled"
    />

    <div v-if="documentManager.errorMessage.value" class="error-banner">
      <span>{{ documentManager.errorMessage.value }}</span>
      <button type="button" @click="documentManager.dismissError">关闭</button>
    </div>

    <UnsavedChangesDialog
      :document="documentManager.pendingCloseDocument.value"
      :busy="documentManager.busy.value"
      :close-all="documentManager.pendingCloseAll.value"
      :theme="resolvedTheme"
      @decide="documentManager.resolvePendingClose"
    />

    <RenameDocumentDialog
      :document="documentManager.pendingRenameDocument.value"
      :busy="documentManager.busy.value"
      :theme="resolvedTheme"
      :error="documentManager.errorMessage.value"
      @cancel="documentManager.cancelRename"
      @rename="documentManager.renameDocument"
    />

    <ExternalFileConflictDialog
      :conflict="documentManager.externalConflict.value"
      :diff-open="documentManager.externalDiffOpen.value"
      :language="externalConflictLanguage"
      :theme="resolvedTheme"
      @reload="documentManager.reloadExternalDiskVersion"
      @keep="documentManager.keepCurrentExternalVersion"
      @diff="documentManager.showExternalDiff"
      @close-diff="documentManager.closeExternalDiff"
      @apply-merged="documentManager.applyExternalMergedContent"
    />
  </main>
</template>

<style scoped lang="scss">
.app-shell {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: 34px 34px minmax(0, 1fr) 24px;
  overflow: hidden;
  color: var(--text-primary);
  background: var(--app-bg);
}

.application-workspace {
  min-width: 0;
  min-height: 0;
  overflow: visible;
  background: var(--panel-bg);
}

.workspace-page {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.empty-workspace {
  height: 100%;
  display: grid;
  place-items: center;
  color: var(--text-muted);
  font-size: 13px;
}

.error-banner {
  position: fixed;
  z-index: 140;
  right: 16px;
  bottom: 38px;
  max-width: min(520px, calc(100vw - 32px));
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--danger) 48%, var(--border-color));
  border-radius: 5px;
  color: var(--danger);
  background: var(--panel-bg);
  box-shadow: var(--popup-shadow);
  font-size: 12px;

  button {
    border: 0;
    color: var(--text-secondary);
    background: transparent;
    cursor: pointer;
  }
}
</style>

