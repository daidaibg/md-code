<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { storeToRefs } from 'pinia';
import NotePanel from '@/notes/components/NotePanel.vue';
import { openSettingsInMainWindow } from '@/notes/noteService';
import { useEditorStore } from '@/store/editor';
import { useSettingsStore } from '@/store/settings';
import { useResolvedTheme } from '@/themes/useResolvedTheme';

const editorStore = useEditorStore();
const settingsStore = useSettingsStore();
const { theme, previewTheme, codeTheme } = storeToRefs(editorStore);
const { monaco } = storeToRefs(settingsStore);
const resolvedTheme = useResolvedTheme(theme);
const notePanel = ref<{ flushPendingSave: () => Promise<void> }>();
let unlistenClose: (() => void) | undefined;
let disposed = false;
let pendingClose: Promise<void> | undefined;
const closeError = ref('');

async function closeWindow(): Promise<void> {
  if (pendingClose) return pendingClose;
  closeError.value = '';
  pendingClose = (async () => {
    try {
      await notePanel.value?.flushPendingSave();
    } catch (error) {
      closeError.value = `保存失败，窗口未关闭：${String(error)}`;
      return;
    }
    try {
      // Destroy only this window after saving; do not trigger another close request.
      await getCurrentWindow().destroy();
    } catch (error) {
      closeError.value = `关闭失败：${String(error)}`;
    }
  })();
  await pendingClose;
  pendingClose = undefined;
}

onMounted(() => {
  void getCurrentWindow()
    .onCloseRequested((event) => {
      event.preventDefault();
      void closeWindow();
    })
    .then((unlisten) => {
      if (disposed) unlisten();
      else unlistenClose = unlisten;
    })
    .catch((error) => {
      closeError.value = `注册关闭事件失败：${String(error)}`;
    });
});

onBeforeUnmount(() => {
  disposed = true;
  unlistenClose?.();
});
</script>

<template>
  <main class="note-window" :data-theme="resolvedTheme">
    <div v-if="closeError" class="close-error" role="alert">{{ closeError }}</div>
    <NotePanel
      ref="notePanel"
      detached
      :directory="settingsStore.notesDirectory"
      :theme="resolvedTheme"
      :preview-theme="previewTheme"
      :code-theme="codeTheme"
      :editor-settings="monaco"
      @close="closeWindow"
      @settings="openSettingsInMainWindow"
      @update:preview-theme="editorStore.setPreviewTheme"
      @update:code-theme="editorStore.setCodeTheme"
    />
  </main>
</template>

<style scoped>
.note-window {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  color: var(--text-primary);
  background: var(--panel-bg);
}
.close-error { position: absolute; z-index: 300; bottom: 12px; right: 12px; max-width: 90%; padding: 10px; color: var(--danger); background: var(--panel-bg); border: 1px solid var(--danger); }
</style>
