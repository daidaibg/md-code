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
const settingsOpen = computed(() => route.name === 'settings');
const recoveryEnabled = typeof window !== 'undefined' && 'localStorage' in window;
const previewSupported = computed(() =>
  activeDocument.value ? supportsPreview(activeDocument.value.language) : false
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
  hasModifiedDocuments: () => editorStore.hasModifiedDocuments,
  isCloseConfirmationPending: () => documentManager.pendingCloseAll.value,
  requestCloseAll: documentManager.requestCloseAll,
  openPath: documentManager.openPath
});

function updateActiveContent(content: string): void {
  if (activeDocument.value) editorStore.updateContent(activeDocument.value.id, content);
}

function updateActiveMode(mode: EditorMode): void {
  if (activeDocument.value) editorStore.setMode(activeDocument.value.id, mode);
}

function closeActiveDocument(): void {
  if (activeDocument.value) documentManager.requestClose(activeDocument.value.id);
}

function openSettings(): void {
  void router.push({ name: 'settings', params: { section: 'appearance' } });
}

function closeSettings(): void {
  void router.push({ name: 'editor' });
}

function installUpdate(): void {
  const install = () => applicationUpdater.installAndRestart();
  if (!documentManager.requestCloseAll(install)) void install();
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
  if (event.key === 'Escape' && settingsOpen.value) {
    closeSettings();
    return;
  }
  if (!(event.ctrlKey || event.metaKey)) return;
  const key = event.key.toLocaleLowerCase();

  if (key === 'n') {
    event.preventDefault();
    documentManager.newDocument();
  } else if (key === 'o') {
    event.preventDefault();
    void documentManager.openDocuments();
  } else if (key === 's') {
    event.preventDefault();
    void documentManager.saveActive(event.shiftKey);
  } else if (key === 'f') {
    event.preventDefault();
    void documentEditor.value?.showFind(false);
  } else if (key === 'h') {
    event.preventDefault();
    void documentEditor.value?.showFind(true);
  } else if (key === 'tab') {
    event.preventDefault();
    editorStore.cycleDocument(event.shiftKey ? -1 : 1);
  } else if (key === 'w' && activeDocument.value) {
    event.preventDefault();
    closeActiveDocument();
  }
}

watch(
  [title, settingsOpen],
  ([value, inSettings]) => {
    document.title = inSettings
      ? '设置 — MD Code'
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
  updateCheckTimer = window.setTimeout(
    () => void applicationUpdater.checkAndDownload(),
    1_500
  );
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
      :mode="activeDocument?.mode ?? 'editor'"
      :language="activeDocument?.language ?? 'plaintext'"
      :preview-supported="previewSupported"
      :recent-files="recentFiles"
      :app-version="packageMetadata.version"
      :update-status="applicationUpdater.status.value"
      :update-version="applicationUpdater.version.value"
      :update-progress="applicationUpdater.progress.value"
      @new="documentManager.newDocument"
      @open="documentManager.openDocuments"
      @save="documentManager.saveActive()"
      @save-as="documentManager.saveActive(true)"
      @close="closeActiveDocument"
      @undo="documentEditor?.undo()"
      @redo="documentEditor?.redo()"
      @search="documentEditor?.showFind(false)"
      @replace="documentEditor?.showFind(true)"
      @select-all="documentEditor?.selectAll()"
      @format="documentEditor?.formatDocument()"
      @open-recent="documentManager.openRecent"
      @clear-recent="editorStore.clearRecent"
      @set-mode="updateActiveMode"
      @cycle-tab="editorStore.cycleDocument"
      @set-theme="editorStore.setTheme"
      @open-settings="openSettings"
      @install-update="installUpdate"
    />

    <DocumentTabs
      :documents="documents"
      :active-id="activeDocumentId"
      :busy="documentManager.busy.value"
      @new="documentManager.newDocument"
      @reorder="editorStore.reorderDocument"
      @activate="editorStore.activateDocument"
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
      <SettingsPage v-if="settingsOpen" @close="closeSettings" />
      <DocumentEditor
        v-else-if="activeDocument"
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
      <div v-else class="empty-workspace">没有打开的文档</div>
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

