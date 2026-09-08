<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import ScrollArea from '@/components/scroll/ScrollArea.vue';
import DocumentEditor from '@/editor/components/DocumentEditor.vue';
import { PaneResizeManager } from '@/editor/layout/PaneResizeManager';
import EditorViewControls from '@/editor/components/EditorViewControls.vue';
import { confirmDesktop } from '@/filesystem/fileSystemService';
import { useNotesStore, type Note } from '@/store/notes';
import { broadcastNotesChange, resolveNotesDirectory, NOTES_CHANGED_EVENT, type NotesChange } from '@/notes/noteService';
import { isTauriRuntime } from '@/filesystem/fileSystemService';
import type { MonacoSettings } from '@/store/settings';
import type { CodeThemeName, CursorPosition, EditorCommand, EditorDocument, EditorMode, PreviewThemeName, ResolvedTheme } from '@/types/editor';

const NoteVisualEditor = defineAsyncComponent(() => import('./NoteVisualEditor.vue'));

const props = defineProps<{
  directory: string;
  theme: ResolvedTheme;
  previewTheme: PreviewThemeName;
  codeTheme: CodeThemeName;
  editorSettings: MonacoSettings;
  detached?: boolean;
}>();
const emit = defineEmits<{
  close: [];
  settings: [];
  detach: [];
  'update:preview-theme': [theme: PreviewThemeName];
  'update:code-theme': [theme: CodeThemeName];
}>();
const store = useNotesStore();
const { activeId, activeNote, orderedNotes, loading, error } = storeToRefs(store);
const search = ref('');
const saving = ref(false);
const sidebarCollapsed = ref(false);
const noteBody = ref<HTMLElement>();
const sidebarWidth = ref(210);
const sidebarResizing = ref(false);
const bodyWidth = ref(0);
let bodyResizeObserver: ResizeObserver | undefined;
const sidebarMaximum = computed(() => Math.max(160, Math.min(480, bodyWidth.value - 247)));
const displayedSidebarWidth = computed(() => sidebarCollapsed.value ? 34 : Math.min(sidebarWidth.value, sidebarMaximum.value));
const noteBodyStyle = computed(() => ({ gridTemplateColumns: `${displayedSidebarWidth.value}px 7px minmax(0, 1fr)` }));
const sidebarResizeManager = new PaneResizeManager({
  edge: 'start',
  getContainer: () => noteBody.value,
  getCurrentSize: () => displayedSidebarWidth.value,
  getBounds: () => ({ min: 34, max: sidebarMaximum.value }),
  onResize: (width) => {
    sidebarCollapsed.value = width < 120;
    if (!sidebarCollapsed.value) sidebarWidth.value = Math.max(160, width);
  },
  onActiveChange: (active) => { sidebarResizing.value = active; }
});
const noteModes = ref<Record<string, EditorMode>>({});
const visualMode = ref(true);
const visualUnavailable = ref('');
const resolvedDirectory = ref('');
const visualEditor = ref<{ focus: () => void; undo: () => void; redo: () => void; selectAll: () => void }>();
let directoryRequest = 0;
const noteCursors = ref<Record<string, CursorPosition>>({});
const noteTocStates = ref<Record<string, boolean>>({});
const renamingId = ref<string | null>(null);
const renameValue = ref('');
const renameInput = ref<HTMLInputElement | null>(null);
const contextMenuRoot = ref<HTMLElement>();
const contextNoteId = ref<string | null>(null);
const contextMenuX = ref(0);
const contextMenuY = ref(0);
const noteEditor = ref<{
  focus: () => Promise<void>;
  showFind: (replace?: boolean) => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  selectAll: () => Promise<void>;
  formatDocument: () => Promise<void>;
  runCommand: (command: EditorCommand) => Promise<void>;
}>();
let saveTimer = 0;
let pendingNote: Note | null = null;
let pendingDirectory = '';
let saveQueue: Promise<void> = Promise.resolve();
let unlistenNotesChanged: (() => void) | undefined;
let disposed = false;
const sourceId = globalThis.crypto?.randomUUID?.() ?? `notes-${Date.now()}-${Math.random()}`;

const visibleNotes = computed(() => {
  const keyword = search.value.trim().toLocaleLowerCase();
  if (!keyword) return orderedNotes.value;
  return orderedNotes.value.filter(note =>
    (store.noteTitle(note) + '\n' + note.content).toLocaleLowerCase().includes(keyword)
  );
});
const editorDocument = computed<EditorDocument | null>(() => {
  const note = activeNote.value;
  if (!note) return null;
  return {
    id: `note:${note.id}`,
    path: resolvedDirectory.value ? `${resolvedDirectory.value.replace(/[\\/]+$/u, '')}/${note.id}.md` : null,
    filename: `${store.noteTitle(note)}.md`,
    language: 'markdown',
    content: note.content,
    modified: false,
    mode: noteModes.value[note.id] ?? 'editor',
    cursor: noteCursors.value[note.id] ?? { lineNumber: 1, column: 1 }
  };
});
const currentMode = computed<EditorMode>(() => visualMode.value ? 'editor' : editorDocument.value?.mode ?? 'editor');
const currentTocOpen = computed(() => activeNote.value
  ? noteTocStates.value[activeNote.value.id] ?? true
  : true
);
const contextNote = computed(() =>
  store.notes.find(note => note.id === contextNoteId.value) ?? null
);
const contextMenuStyle = computed(() => ({
  left: `${contextMenuX.value}px`,
  top: `${contextMenuY.value}px`
}));

function formatUpdatedAt(value: number): string {
  if (!value) return '';
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(value);
}

function scheduleSave(content: string): void {
  const note = store.updateContent(content);
  if (!note) return;
  if (pendingNote && pendingNote.id !== note.id) void save(pendingDirectory, pendingNote);
  const snapshot = { ...note };
  pendingNote = snapshot;
  pendingDirectory = props.directory;
  window.clearTimeout(saveTimer);
  const directory = props.directory;
  saveTimer = window.setTimeout(() => void save(directory, snapshot), 350);
}

function save(directory: string, note: Note): Promise<void> {
  const snapshot = { ...note };
  saveQueue = saveQueue.then(() => persistSnapshot(directory, snapshot));
  return saveQueue;
}

async function persistSnapshot(directory: string, note: Note): Promise<void> {
  saving.value = true;
  const saved = await store.persist(directory, note);
  if (saved) {
    void broadcastNotesChange({ sourceId, directory, type: 'save', id: note.id, note: { ...note } });
  }
  if (saved && pendingNote?.id === note.id && pendingNote.updatedAt === note.updatedAt) pendingNote = null;
  saving.value = false;
}

async function createNote(): Promise<void> {
  const saved = await store.create(props.directory);
  if (saved && activeNote.value) {
    await broadcastNotesChange({
      sourceId,
      directory: props.directory,
      type: 'save',
      id: activeNote.value.id,
      note: { ...activeNote.value }
    });
  }
}

function updateMode(mode: EditorMode): void {
  visualMode.value = false;
  if (activeNote.value) noteModes.value[activeNote.value.id] = mode;
}

function useVisualEditor(): void {
  visualUnavailable.value = '';
  visualMode.value = true;
}

function onVisualUnavailable(reason: string): void {
  visualUnavailable.value = reason;
  updateMode('editor');
}

async function showFind(replace?: boolean): Promise<void> {
  updateMode('editor');
  await nextTick();
  await noteEditor.value?.showFind(replace);
}

function updateCursor(cursor: CursorPosition): void {
  if (activeNote.value) noteCursors.value[activeNote.value.id] = cursor;
}

function toggleCurrentToc(): void {
  if (activeNote.value) noteTocStates.value[activeNote.value.id] = !currentTocOpen.value;
}

async function beginRename(note: Note): Promise<void> {
  activeId.value = note.id;
  renamingId.value = note.id;
  renameValue.value = store.noteTitle(note);
  await nextTick();
  renameInput.value?.focus();
  renameInput.value?.select();
}

function closeContextMenu(): void {
  contextNoteId.value = null;
}

async function openContextMenu(event: MouseEvent, note: Note): Promise<void> {
  activeId.value = note.id;
  contextNoteId.value = note.id;
  contextMenuX.value = event.clientX;
  contextMenuY.value = event.clientY;
  await nextTick();
  const menu = contextMenuRoot.value;
  if (!menu) return;
  const margin = 6;
  contextMenuX.value = Math.max(margin, Math.min(event.clientX, window.innerWidth - menu.offsetWidth - margin));
  contextMenuY.value = Math.max(margin, Math.min(event.clientY, window.innerHeight - menu.offsetHeight - margin));
}

function onDocumentPointerdown(event: PointerEvent): void {
  if (!contextMenuRoot.value?.contains(event.target as Node)) closeContextMenu();
}

function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') closeContextMenu();
}

function renameFromContextMenu(): void {
  const note = contextNote.value;
  closeContextMenu();
  if (note) void beginRename(note);
}

function deleteFromContextMenu(): void {
  const note = contextNote.value;
  closeContextMenu();
  if (note) void removeNote(note);
}

function setRenameInput(element: unknown): void {
  renameInput.value = element instanceof HTMLInputElement ? element : null;
}

function cancelRename(): void {
  renamingId.value = null;
  renameValue.value = '';
}

async function commitRename(note: Note): Promise<void> {
  if (renamingId.value !== note.id) return;
  const title = renameValue.value.trim();
  cancelRename();
  if (!title || title === store.noteTitle(note)) return;
  await flushPendingSave();
  const renamed = store.renameTitle(note.id, title);
  if (renamed) await save(props.directory, { ...renamed });
}

async function removeNote(note: Note): Promise<void> {
  if (!await confirmDesktop(`确定删除便签“${store.noteTitle(note)}”吗？此操作无法撤销。`, '删除便签')) return;
  if (pendingNote?.id === note.id) {
    window.clearTimeout(saveTimer);
    pendingNote = null;
  }
  const id = note.id;
  if (await store.remove(props.directory, id)) {
    await broadcastNotesChange({ sourceId, directory: props.directory, type: 'delete', id });
  }
}

async function flushPendingSave(): Promise<void> {
  window.clearTimeout(saveTimer);
  await saveQueue;
  const note = pendingNote;
  if (note) await save(pendingDirectory, note);
  if (error.value) throw new Error(error.value);
}

defineExpose({
  flushPendingSave,
  currentMode,
  setMode: updateMode,
  focus: async () => { if (visualMode.value) visualEditor.value?.focus(); else await noteEditor.value?.focus(); },
  showFind,
  undo: async () => { if (visualMode.value) visualEditor.value?.undo(); else await noteEditor.value?.undo(); },
  redo: async () => { if (visualMode.value) visualEditor.value?.redo(); else await noteEditor.value?.redo(); },
  selectAll: async () => { if (visualMode.value) visualEditor.value?.selectAll(); else await noteEditor.value?.selectAll(); },
  formatDocument: async () => { updateMode('editor'); await nextTick(); await noteEditor.value?.formatDocument(); }
});

watch(activeId, () => { visualMode.value = true; visualUnavailable.value = ''; });
watch(() => props.directory, async directory => {
  const request = ++directoryRequest;
  resolvedDirectory.value = '';
  if (!isTauriRuntime()) return;
  try {
    const path = await resolveNotesDirectory(directory);
    if (request === directoryRequest && !disposed) resolvedDirectory.value = path;
  } catch (reason) {
    if (request === directoryRequest && !disposed) visualUnavailable.value = `读取便签图片目录失败：${String(reason)}`;
  }
}, { immediate: true });
watch(() => props.directory, directory => void store.load(directory));
onMounted(() => {
  bodyResizeObserver = new ResizeObserver(() => {
    if (noteBody.value?.clientWidth) bodyWidth.value = noteBody.value.clientWidth;
  });
  if (noteBody.value) bodyResizeObserver.observe(noteBody.value);
  document.addEventListener('pointerdown', onDocumentPointerdown);
  document.addEventListener('keydown', onDocumentKeydown);
  window.addEventListener('resize', closeContextMenu);
  window.addEventListener('blur', closeContextMenu);
  void store.load(props.directory);
  if (isTauriRuntime()) {
    void import('@tauri-apps/api/event').then(async ({ listen }) => {
      const unlisten = await listen<NotesChange>(NOTES_CHANGED_EVENT, ({ payload }) => {
        if (payload.sourceId === sourceId || payload.directory !== props.directory) return;
        if (pendingNote?.id === payload.id) {
          if (payload.type === 'delete') return;
          if (payload.note && pendingNote.updatedAt >= payload.note.updatedAt) return;
        }
        if (payload.type === 'save' && payload.note) store.applyExternalSave(payload.note);
        else if (payload.type === 'delete') store.applyExternalDelete(payload.id);
      });
      if (disposed) unlisten();
      else unlistenNotesChanged = unlisten;
    });
  }
});
onBeforeUnmount(() => {
  sidebarResizeManager.destroy();
  bodyResizeObserver?.disconnect();
  disposed = true;
  document.removeEventListener('pointerdown', onDocumentPointerdown);
  document.removeEventListener('keydown', onDocumentKeydown);
  window.removeEventListener('resize', closeContextMenu);
  window.removeEventListener('blur', closeContextMenu);
  unlistenNotesChanged?.();
  void flushPendingSave().catch(() => { /* The store retains the save error. */ });
});
</script>

<template>
  <aside class="note-panel" :class="{ detached }" aria-label="Markdown 便签">
    <header class="note-header">
      <strong>便签</strong>
      <div v-if="activeNote" class="note-editor-switch" role="group" aria-label="便签编辑方式">
        <button type="button" :class="{ selected: visualMode }" :aria-pressed="visualMode" @click="useVisualEditor">可视化</button>
        <button type="button" :class="{ selected: !visualMode }" :aria-pressed="!visualMode" @click="updateMode('editor')">源码</button>
      </div>
      <EditorViewControls
        v-if="activeNote"
        class="note-view-controls"
        :visual="visualMode"
        :mode="currentMode"
        :toc-open="currentTocOpen"
        :preview-theme="previewTheme"
        :code-theme="codeTheme"
        @update:mode="updateMode"
        @update:preview-theme="emit('update:preview-theme', $event)"
        @update:code-theme="emit('update:code-theme', $event)"
        @toggle-toc="toggleCurrentToc"
      />
      <span class="save-state">{{ error ? '保存失败' : saving ? '保存中…' : '自动保存' }}</span>
      <button v-if="!detached" type="button" title="在独立窗口中打开" aria-label="在独立窗口中打开便签" @click="emit('detach')">↗</button>
      <button type="button" title="便签设置" @click="emit('settings')">⚙</button>
    </header>

    <div ref="noteBody" class="note-body" :class="{ 'sidebar-collapsed': sidebarCollapsed, 'sidebar-resizing': sidebarResizing }" :style="noteBodyStyle">
      <aside class="note-sidebar" aria-label="便签侧边栏">
        <div class="sidebar-actions">
          <button
            type="button"
            class="collapse-action"
            :title="sidebarCollapsed ? '展开便签列表' : '收起便签列表'"
            :aria-label="sidebarCollapsed ? '展开便签列表' : '收起便签列表'"
            @click="sidebarCollapsed = !sidebarCollapsed"
          >{{ sidebarCollapsed ? '›' : '‹' }}</button>
          <template v-if="!sidebarCollapsed">
            <input v-model="search" type="search" placeholder="搜索" aria-label="搜索便签" />
            <button type="button" class="primary" title="新建便签" aria-label="新建便签" @click="createNote">＋</button>
          </template>
        </div>
        <ScrollArea v-if="!sidebarCollapsed" class="note-list" label="便签列表">
        <div
          v-for="note in visibleNotes"
          :key="note.id"
          class="note-list-item"
          role="button"
          tabindex="0"
          :class="{ active: note.id === activeId }"
          @click="activeId = note.id"
          @keydown.enter="activeId = note.id"
          @dblclick="beginRename(note)"
          @contextmenu.prevent.stop="openContextMenu($event, note)"
        >
          <input
            v-if="renamingId === note.id"
            :ref="setRenameInput"
            v-model="renameValue"
            class="note-name-input"
            maxlength="60"
            aria-label="便签名称"
            @click.stop
            @dblclick.stop
            @keydown.enter.prevent.stop="commitRename(note)"
            @keydown.escape.prevent.stop="cancelRename"
            @blur="commitRename(note)"
          />
          <strong v-else>{{ store.noteTitle(note) }}</strong>
          <small>{{ formatUpdatedAt(note.updatedAt) }}</small>
          <span>{{ note.content.replace(/^#{1,6}\s+/u, '').replace(/\s+/gu, ' ').slice(0, 75) }}</span>
        </div>
        <p v-if="!loading && visibleNotes.length === 0" class="note-empty">{{ search ? '没有匹配的便签' : '点击“新建”创建 Markdown 便签' }}</p>
        </ScrollArea>
      </aside>

      <div
        class="sidebar-resizer"
        role="separator"
        aria-label="调整便签侧栏宽度，拖窄可自动收起"
        aria-orientation="vertical"
        :aria-valuenow="displayedSidebarWidth"
        :aria-valuemin="34"
        :aria-valuemax="sidebarMaximum"
        tabindex="0"
        @pointerdown="sidebarResizeManager.start($event)"
        @keydown.left.prevent="sidebarResizeManager.resizeBy(-24)"
        @keydown.right.prevent="sidebarResizeManager.resizeBy(sidebarCollapsed ? 126 : 24)"
        @dblclick="sidebarCollapsed = !sidebarCollapsed"
      />
      <section class="note-editor">
        <p v-if="visualUnavailable" class="visual-unavailable" role="status">{{ visualUnavailable }}</p>
        <template v-if="activeNote && editorDocument">
          <div v-if="visualMode && isTauriRuntime() && !resolvedDirectory" class="note-placeholder">正在读取便签目录，可切换源码继续编辑…</div>
          <NoteVisualEditor
            v-else-if="visualMode"
            :key="`visual:${activeNote.id}`"
            ref="visualEditor"
            :source="activeNote.content"
            :theme="theme"
            :toc-open="currentTocOpen"
            :document-path="editorDocument.path"
            :preview-theme="previewTheme"
            :code-theme="codeTheme"
            @update:source="scheduleSave"
            @request-source="updateMode('editor')"
            @unavailable="onVisualUnavailable"
          />
          <DocumentEditor
            v-else
            :key="activeNote.id"
            ref="noteEditor"
            :document="editorDocument"
            :theme="theme"
            :preview-theme="previewTheme"
            :code-theme="codeTheme"
            :editor-settings="editorSettings"
            break-on-newline
            external-view-controls
            :external-toc-open="currentTocOpen"
            @update:content="scheduleSave"
            @update:mode="updateMode"
            @update:cursor="updateCursor"
            @update:preview-theme="emit('update:preview-theme', $event)"
            @update:code-theme="emit('update:code-theme', $event)"
            @toggle-toc="toggleCurrentToc"
          />
        </template>
        <div v-else class="note-placeholder">选择或新建一条便签</div>
      </section>
    </div>
    <div v-if="error" class="note-error" role="alert">{{ error }}</div>
  </aside>

  <section
    v-if="contextNote"
    ref="contextMenuRoot"
    class="note-context-menu"
    :style="contextMenuStyle"
    role="menu"
    :aria-label="`${store.noteTitle(contextNote)} 便签菜单`"
    @pointerdown.stop
    @contextmenu.prevent
  >
    <button type="button" role="menuitem" @click="renameFromContextMenu">重命名</button>
    <button type="button" class="danger" role="menuitem" @click="deleteFromContextMenu">删除</button>
  </section>
</template>

<style scoped lang="scss">
.note-panel {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: 34px minmax(0, 1fr);
  color: var(--text-primary);
  background: var(--panel-bg);
  overflow: hidden;
}
.note-header { display: flex; align-items: center; }
.note-header { gap: 6px; padding: 0 7px 0 12px; border-bottom: 1px solid var(--border-color); background: var(--chrome-bg); }
.note-header strong { margin-right: auto; flex: 0 0 auto; font-size: 13px; }
.note-view-controls { flex: 0 1 auto; }
.save-state { flex: 0 0 auto; color: var(--text-muted); font-size: 10px; }
.note-header button, .sidebar-actions button { border: 0; border-radius: 4px; color: var(--text-secondary); background: transparent; cursor: pointer; }
.note-header > button { width: 25px; height: 25px; font-size: 15px; }
.note-header > button { flex-shrink: 0; }
.note-header button:hover { color: var(--text-primary); background: var(--control-hover); }
.note-body { min-height: 0; min-width: 0; display: grid; }
.sidebar-resizer { position: relative; z-index: 8; cursor: col-resize; touch-action: none; background: transparent; }
.sidebar-resizer::after { content: ''; position: absolute; top: 0; bottom: 0; left: 3px; width: 1px; background: var(--border-color); }
.sidebar-resizer:hover::after, .sidebar-resizer:focus-visible::after, .sidebar-resizing .sidebar-resizer::after { background: var(--accent); }
.sidebar-resizing { user-select: none; }
.note-sidebar { min-width: 0; min-height: 0; display: grid; grid-template-rows: 37px minmax(0, 1fr); border-right: 1px solid var(--border-color); background: var(--panel-muted); overflow: hidden; }
.note-body.sidebar-collapsed .note-sidebar { grid-template-rows: 37px; }
.sidebar-actions { min-width: 0; display: flex; align-items: center; gap: 4px; padding: 4px; border-bottom: 1px solid var(--border-subtle); }
.sidebar-actions input { min-width: 0; height: 27px; flex: 1; padding: 0 7px; border: 1px solid var(--border-color); border-radius: 4px; color: inherit; background: var(--panel-bg); font-size: 11px; outline: none; }
.sidebar-actions input:focus { border-color: var(--accent); }
.sidebar-actions button { width: 27px; height: 27px; flex: 0 0 27px; padding: 0; font-size: 15px; }
.sidebar-actions button:hover:not(:disabled) { color: var(--accent); background: color-mix(in srgb, var(--accent) 13%, var(--panel-bg)); }
.sidebar-actions .collapse-action { order: -1; font-size: 20px; line-height: 1; }
.sidebar-actions .primary { color: #fff; background: var(--accent); }
.note-list { min-height: 0; }
.note-list-item { position: relative; width: 100%; display: grid; gap: 3px; padding: 10px 12px; border: 0; border-bottom: 1px solid var(--border-subtle); color: inherit; background: transparent; text-align: left; cursor: pointer; }
.note-list-item:hover { background: var(--control-hover); }
.note-list-item.active { background: color-mix(in srgb, var(--accent) 12%, var(--panel-bg)); }
.note-list-item strong, .note-list-item span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.note-list-item strong { font-size: 12px; }
.note-list-item small { color: var(--text-muted); font-size: 9px; }
.note-list-item span { color: var(--text-secondary); font-size: 10px; }
.note-context-menu { position: fixed; z-index: 230; width: 156px; padding: 5px; border: 1px solid var(--menu-popup-border); border-radius: 5px; color: var(--menu-text); background: var(--menu-popup-bg); box-shadow: var(--popup-shadow); font-size: 12px; }
.note-context-menu button { width: 100%; height: 30px; padding: 0 10px; border: 0; border-radius: 3px; color: inherit; background: transparent; text-align: left; cursor: pointer; }
.note-context-menu button:hover, .note-context-menu button:focus-visible { color: var(--menu-selection-text); background: var(--menu-selection-bg); outline: none; }
.note-context-menu button.danger { color: var(--danger); }
.note-empty, .note-placeholder { color: var(--text-muted); font-size: 11px; text-align: center; }
.note-empty { padding: 30px 12px; }
.note-name-input { min-width: 0; width: 100%; height: 23px; padding: 0 5px; border: 1px solid var(--accent); border-radius: 3px; color: var(--text-primary); background: var(--panel-bg); font: inherit; outline: none; }
.note-editor { position: relative; display: flex; flex-direction: column; min-width: 0; min-height: 0; overflow: hidden; }
.note-editor > :deep(.document-editor), .note-editor > :deep(.note-visual-editor) { flex: 1; min-height: 0; }
.note-editor-switch { display: flex; gap: 2px; flex-shrink: 0; padding: 2px; border: 1px solid var(--border-color); border-radius: 7px; background: var(--panel-bg); }
.note-editor-switch button { width: auto; height: 25px; padding: 0 11px; font-size: 12px; border: 1px solid transparent; transition: background .16s, color .16s; }
.note-editor-switch button.selected { background: color-mix(in srgb, var(--accent) 15%, var(--panel-bg)); color: var(--accent); border-color: color-mix(in srgb, var(--accent) 38%, transparent); font-weight: 600; box-shadow: inset 0 -2px 0 var(--accent); }
.note-editor-switch button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.visual-unavailable { flex: 0 0 auto; margin: 0; padding: 6px 12px; font-size: 12px; color: var(--text-secondary); background: var(--panel-bg); }
@media (max-width: 980px) {
  .note-panel { grid-template-rows: auto minmax(0, 1fr); }
  .note-header { flex-wrap: wrap; min-height: 34px; padding-top: 3px; padding-bottom: 3px; }
  .note-view-controls { order: 1; flex: 1 0 100%; justify-content: flex-end; }
}
.note-placeholder { display: grid; place-items: center; grid-row: 1 / -1; }
.note-error { position: absolute; right: 12px; bottom: 12px; max-width: 360px; padding: 8px 10px; border: 1px solid var(--danger); border-radius: 4px; color: var(--danger); background: var(--panel-bg); font-size: 10px; }
</style>
