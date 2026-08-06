<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import FileTypeIcon from '@/components/icons/FileTypeIcon.vue';
import ToolbarIcon from '@/components/icons/ToolbarIcon.vue';
import { TabDragManager } from '@/tabs/TabDragManager';
import type { EditorDocument } from '@/types/editor';

const props = defineProps<{
  documents: EditorDocument[];
  activeId: string;
  busy: boolean;
}>();

const emit = defineEmits<{
  new: [];
  reorder: [documentId: string, oldIndex: number, newIndex: number];
  activate: [id: string];
  save: [id: string];
  'save-as': [id: string];
  reveal: [id: string];
  'copy-path': [id: string];
  rename: [id: string];
  close: [id: string];
  'close-others': [id: string];
  'close-left': [id: string];
  'close-right': [id: string];
}>();

type ContextAction =
  | 'save'
  | 'save-as'
  | 'reveal'
  | 'copy-path'
  | 'rename'
  | 'close'
  | 'close-others'
  | 'close-left'
  | 'close-right';

const tabsRoot = ref<HTMLElement>();
const contextMenuRoot = ref<HTMLElement>();
const contextDocumentId = ref<string | null>(null);
const contextMenuX = ref(0);
const contextMenuY = ref(0);
const hasHorizontalOverflow = ref(false);
const scrollbarThumbWidth = ref(0);
const scrollbarThumbOffset = ref(0);
const scrollbarDragging = ref(false);
const contextDocument = computed(
  () => props.documents.find((document) => document.id === contextDocumentId.value) ?? null
);
const contextDocumentIndex = computed(() =>
  props.documents.findIndex((document) => document.id === contextDocumentId.value)
);
const canCloseOthers = computed(() => props.documents.length > 1);
const canCloseLeft = computed(() => contextDocumentIndex.value > 0);
const canCloseRight = computed(
  () => contextDocumentIndex.value >= 0 && contextDocumentIndex.value < props.documents.length - 1
);
const contextMenuStyle = computed(() => ({
  left: `${contextMenuX.value}px`,
  top: `${contextMenuY.value}px`
}));
let tabDragManager: TabDragManager | undefined;
let tabsResizeObserver: ResizeObserver | undefined;
let scrollbarDragStartX = 0;
let scrollbarDragStartLeft = 0;

const duplicateNames = computed(() => {
  const counts = new Map<string, number>();
  for (const document of props.documents) {
    const key = document.filename.toLocaleLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
});

function shouldShowParentDirectory(document: EditorDocument): boolean {
  return (
    Boolean(document.path) &&
    (duplicateNames.value.get(document.filename.toLocaleLowerCase()) ?? 0) > 1
  );
}

function parentDirectory(document: EditorDocument): string {
  if (!document.path) return '';
  const parts = document.path.split(/[\\/]/u).filter(Boolean);
  parts.pop();
  return parts.pop() ?? document.path;
}

function closeContextMenu(): void {
  contextDocumentId.value = null;
}

async function openContextMenu(event: MouseEvent, document: EditorDocument): Promise<void> {
  contextMenuX.value = event.clientX;
  contextMenuY.value = event.clientY;
  contextDocumentId.value = document.id;
  emit('activate', document.id);

  await nextTick();
  const menu = contextMenuRoot.value;
  if (!menu) return;
  const margin = 6;
  contextMenuX.value = Math.max(
    margin,
    Math.min(event.clientX, window.innerWidth - menu.offsetWidth - margin)
  );
  contextMenuY.value = Math.max(
    margin,
    Math.min(event.clientY, window.innerHeight - menu.offsetHeight - margin)
  );
}

function runContextAction(action: ContextAction): void {
  const document = contextDocument.value;
  if (!document || props.busy) return;
  closeContextMenu();

  if (action === 'save') emit('save', document.id);
  else if (action === 'save-as') emit('save-as', document.id);
  else if (action === 'reveal') emit('reveal', document.id);
  else if (action === 'copy-path') emit('copy-path', document.id);
  else if (action === 'rename') emit('rename', document.id);
  else if (action === 'close') emit('close', document.id);
  else if (action === 'close-others') emit('close-others', document.id);
  else if (action === 'close-left') emit('close-left', document.id);
  else emit('close-right', document.id);
}

function onDocumentPointerdown(event: PointerEvent): void {
  if (!contextMenuRoot.value?.contains(event.target as Node)) closeContextMenu();
}

function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') closeContextMenu();
}

function updateTabsScrollbar(): void {
  const tabs = tabsRoot.value;
  if (!tabs) return;

  const { clientWidth, scrollLeft, scrollWidth } = tabs;
  hasHorizontalOverflow.value = scrollWidth > clientWidth + 1;
  if (!hasHorizontalOverflow.value) {
    scrollbarThumbWidth.value = 0;
    scrollbarThumbOffset.value = 0;
    return;
  }

  const thumbWidth = Math.max(36, (clientWidth / scrollWidth) * clientWidth);
  const availableTrack = Math.max(0, clientWidth - thumbWidth);
  const availableScroll = Math.max(1, scrollWidth - clientWidth);
  scrollbarThumbWidth.value = thumbWidth;
  scrollbarThumbOffset.value = (scrollLeft / availableScroll) * availableTrack;
}

const scrollbarThumbStyle = computed(() => ({
  width: `${scrollbarThumbWidth.value}px`,
  transform: `translateX(${scrollbarThumbOffset.value}px)`
}));

function onTabsScroll(): void {
  closeContextMenu();
  updateTabsScrollbar();
}

async function revealActiveTab(): Promise<void> {
  await nextTick();
  const tabs = tabsRoot.value;
  if (!tabs) return;

  const activeTab = [...tabs.querySelectorAll<HTMLElement>('.document-tab')].find(
    (tab) => tab.dataset.documentId === props.activeId
  );
  if (!activeTab) return;

  const edgePadding = 8;
  const visibleLeft = tabs.scrollLeft;
  const visibleRight = visibleLeft + tabs.clientWidth;
  const tabLeft = activeTab.offsetLeft;
  const tabRight = tabLeft + activeTab.offsetWidth;

  if (tabLeft < visibleLeft + edgePadding) {
    tabs.scrollTo({ left: Math.max(0, tabLeft - edgePadding), behavior: 'smooth' });
  } else if (tabRight > visibleRight - edgePadding) {
    tabs.scrollTo({
      left: tabRight - tabs.clientWidth + edgePadding,
      behavior: 'smooth'
    });
  }
}

function onScrollbarPointerdown(event: PointerEvent): void {
  const tabs = tabsRoot.value;
  const thumb = event.currentTarget as HTMLElement;
  if (!tabs || event.button !== 0) return;

  event.preventDefault();
  scrollbarDragging.value = true;
  scrollbarDragStartX = event.clientX;
  scrollbarDragStartLeft = tabs.scrollLeft;
  thumb.setPointerCapture(event.pointerId);
}

function onScrollbarPointermove(event: PointerEvent): void {
  const tabs = tabsRoot.value;
  if (!tabs || !scrollbarDragging.value) return;

  const trackRange = tabs.clientWidth - scrollbarThumbWidth.value;
  const scrollRange = tabs.scrollWidth - tabs.clientWidth;
  if (trackRange <= 0 || scrollRange <= 0) return;
  tabs.scrollLeft = scrollbarDragStartLeft +
    (event.clientX - scrollbarDragStartX) * (scrollRange / trackRange);
}

function onScrollbarPointerup(event: PointerEvent): void {
  if (!scrollbarDragging.value) return;
  scrollbarDragging.value = false;
  const thumb = event.currentTarget as HTMLElement;
  if (thumb.hasPointerCapture(event.pointerId)) thumb.releasePointerCapture(event.pointerId);
}

function onTabsWheel(event: WheelEvent): void {
  const tabs = tabsRoot.value;
  if (!tabs || tabs.scrollWidth <= tabs.clientWidth) return;

  const rawDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
  if (rawDelta === 0) return;

  const deltaScale = event.deltaMode === WheelEvent.DOM_DELTA_LINE
    ? 32
    : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
      ? tabs.clientWidth
      : 1;
  event.preventDefault();
  tabs.scrollLeft += rawDelta * deltaScale;
  closeContextMenu();
}

onMounted(() => {
  if (tabsRoot.value) {
    tabDragManager = new TabDragManager(tabsRoot.value, {
      onReorder: ({ documentId, oldIndex, newIndex }) =>
        emit('reorder', documentId, oldIndex, newIndex)
    });
    tabsResizeObserver = new ResizeObserver(updateTabsScrollbar);
    tabsResizeObserver.observe(tabsRoot.value);
    updateTabsScrollbar();
  }
  document.addEventListener('pointerdown', onDocumentPointerdown);
  document.addEventListener('keydown', onDocumentKeydown);
  window.addEventListener('resize', closeContextMenu);
  window.addEventListener('blur', closeContextMenu);
});

onBeforeUnmount(() => {
  tabDragManager?.destroy();
  tabDragManager = undefined;
  tabsResizeObserver?.disconnect();
  tabsResizeObserver = undefined;
  document.removeEventListener('pointerdown', onDocumentPointerdown);
  document.removeEventListener('keydown', onDocumentKeydown);
  window.removeEventListener('resize', closeContextMenu);
  window.removeEventListener('blur', closeContextMenu);
});

watch(
  () =>
    props.documents
      .map(
        (document) =>
          `${document.id}:${document.filename}:${document.path ?? ''}:${document.modified}`
      )
      .join('|'),
  () => void nextTick(updateTabsScrollbar)
);

watch(() => props.activeId, () => void revealActiveTab(), { immediate: true });
</script>

<template>
  <div class="document-tabs-shell" :class="{ 'scrollbar-dragging': scrollbarDragging }">
    <div class="tabs-viewport">
      <nav
        ref="tabsRoot"
        class="document-tabs"
        aria-label="打开的文档"
        @scroll.passive="onTabsScroll"
        @wheel="onTabsWheel"
      >
        <button
          v-for="document in documents"
          :key="document.id"
          type="button"
          class="document-tab"
          :data-document-id="document.id"
          :class="{ active: document.id === activeId }"
          :title="document.path ?? document.filename"
          @click="emit('activate', document.id)"
          @contextmenu.prevent.stop="openContextMenu($event, document)"
          @auxclick.middle.prevent="emit('close', document.id)"
        >
          <FileTypeIcon :language="document.language" :filename="document.filename" />
          <span class="tab-label">
            <span class="filename">{{ document.filename }}</span>
            <span v-if="shouldShowParentDirectory(document)" class="parent-name">
              {{ parentDirectory(document) }}
            </span>
          </span>
          <span
            v-if="document.modified || !document.path"
            class="modified-dot"
            title="未保存"
            aria-label="未保存"
          />
          <span
            class="close-button"
            role="button"
            tabindex="0"
            :aria-label="`关闭 ${document.filename}`"
            @click.stop="emit('close', document.id)"
            @keydown.enter.stop="emit('close', document.id)"
            @keydown.space.prevent.stop="emit('close', document.id)"
          >
            <ToolbarIcon name="close" />
          </span>
        </button>
      </nav>

      <div v-show="hasHorizontalOverflow" class="tabs-scrollbar" aria-hidden="true">
        <span
          class="tabs-scrollbar-thumb"
          :style="scrollbarThumbStyle"
          @pointerdown="onScrollbarPointerdown"
          @pointermove="onScrollbarPointermove"
          @pointerup="onScrollbarPointerup"
          @pointercancel="onScrollbarPointerup"
        />
      </div>
    </div>

    <button
      type="button"
      class="new-document-button"
      title="新建文件 (Ctrl+N)"
      aria-label="新建文件"
      :disabled="busy"
      @click="emit('new')"
    >
      <ToolbarIcon name="new-file" />
    </button>
  </div>

  <section
    v-if="contextDocument"
    ref="contextMenuRoot"
    class="tab-context-menu"
    :style="contextMenuStyle"
    role="menu"
    :aria-label="`${contextDocument.filename} 标签页菜单`"
    @pointerdown.stop
    @contextmenu.prevent
  >
    <button
      type="button"
      class="context-menu-item"
      role="menuitem"
      :disabled="busy"
      @click="runContextAction('save')"
    >
      <ToolbarIcon name="save" />
      <span>保存</span>
      <kbd>Ctrl+S</kbd>
    </button>
    <button
      type="button"
      class="context-menu-item"
      role="menuitem"
      :disabled="busy"
      @click="runContextAction('save-as')"
    >
      <ToolbarIcon name="save-as" />
      <span>另存为</span>
      <kbd>Ctrl+Shift+S</kbd>
    </button>
    <button
      type="button"
      class="context-menu-item"
      role="menuitem"
      :disabled="busy"
      @click="runContextAction('rename')"
    >
      <ToolbarIcon name="file" />
      <span>重命名</span>
    </button>
    <div class="context-menu-separator" role="separator" />
    <button
      type="button"
      class="context-menu-item"
      role="menuitem"
      :disabled="busy || !contextDocument.path"
      @click="runContextAction('reveal')"
    >
      <ToolbarIcon name="open" />
      <span>在文件资源管理器中打开</span>
    </button>
    <button
      type="button"
      class="context-menu-item"
      role="menuitem"
      :disabled="busy || !contextDocument.path"
      @click="runContextAction('copy-path')"
    >
      <ToolbarIcon name="file" />
      <span>复制路径</span>
    </button>
    <div class="context-menu-separator" role="separator" />
    <button
      type="button"
      class="context-menu-item"
      role="menuitem"
      :disabled="busy"
      @click="runContextAction('close')"
    >
      <ToolbarIcon name="close" />
      <span>关闭</span>
      <kbd>Ctrl+W</kbd>
    </button>
    <button
      type="button"
      class="context-menu-item"
      role="menuitem"
      :disabled="busy || !canCloseOthers"
      @click="runContextAction('close-others')"
    >
      <ToolbarIcon name="close" />
      <span>关闭其他标签页</span>
    </button>
    <button
      type="button"
      class="context-menu-item"
      role="menuitem"
      :disabled="busy || !canCloseLeft"
      @click="runContextAction('close-left')"
    >
      <ToolbarIcon name="close" />
      <span>关闭左侧标签页</span>
    </button>
    <button
      type="button"
      class="context-menu-item"
      role="menuitem"
      :disabled="busy || !canCloseRight"
      @click="runContextAction('close-right')"
    >
      <ToolbarIcon name="close" />
      <span>关闭右侧标签页</span>
    </button>
  </section>
</template>

<style scoped lang="scss">
.document-tabs-shell {
  min-width: 0;
  height: 34px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 34px;
  overflow: hidden;
  border-bottom: 1px solid var(--border-color);
  background: var(--tabs-bg);
}

.tabs-viewport {
  position: relative;
  min-width: 0;
  height: 33px;
  overflow: hidden;
}

.document-tabs {
  min-width: 0;
  width: 100%;
  height: 33px;
  display: flex;
  align-items: stretch;
  overflow-x: auto;
  overflow-y: hidden;
  background: var(--tabs-bg);
  scrollbar-width: none;

  &::-webkit-scrollbar {
    width: 0;
    height: 0;
    display: none;
  }
}

.tabs-scrollbar {
  position: absolute;
  z-index: 8;
  right: 0;
  bottom: 0;
  left: 0;
  height: 3px;
  opacity: 0;
  transition: opacity 0.12s ease;
}

.tabs-viewport:hover .tabs-scrollbar,
.document-tabs-shell.scrollbar-dragging .tabs-scrollbar {
  opacity: 1;
}

.tabs-scrollbar-thumb {
  position: absolute;
  top: 0;
  left: 0;
  height: 2px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text-muted) 58%, transparent);
  cursor: default;
  touch-action: none;

  &:hover,
  .scrollbar-dragging & {
    height: 3px;
    background: color-mix(in srgb, var(--text-muted) 74%, transparent);
  }
}

.document-tab {
  position: relative;
  flex: 0 0 auto;
  min-width: 100px;
  max-width: 250px;
  height: 33px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 6px 0 10px;
  border: 0;
  border-right: 1px solid var(--border-color);
  color: var(--text-muted);
  background: var(--tab-bg);
  cursor: grab;
  transition:
    color 0.14s ease,
    background-color 0.14s ease,
    box-shadow 0.14s ease;

  &::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 2px;
    background: transparent;
  }

  &:hover { color: var(--text-primary); background: var(--control-hover); }
  &.active {
    color: var(--text-primary);
    background: var(--panel-bg);
    &::after { background: var(--accent); }
  }
}

.document-tabs :deep(.tab-drag-ghost) {
  opacity: 1 !important;
  color: transparent !important;
  background: color-mix(in srgb, var(--accent) 8%, var(--tabs-bg)) !important;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent);

  &::after { background: transparent !important; }
  > * { visibility: hidden; }
}

.document-tabs :deep(.tab-drag-chosen) {
  color: var(--text-primary);
  background: var(--panel-bg);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 32%, transparent);
}

.document-tabs :deep(.tab-drag-active) {
  cursor: grabbing;
}

.document-tab.tab-drop-before::before,
.document-tab.tab-drop-after::before {
  content: '';
  position: absolute;
  z-index: 4;
  top: 3px;
  bottom: 3px;
  width: 2px;
  border-radius: 2px;
  background: var(--accent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent);
  pointer-events: none;
}

.document-tab.tab-drop-before::before {
  left: -1px;
}

.document-tab.tab-drop-after::before {
  right: -1px;
}

.document-tabs.tab-list-dragging {
  cursor: grabbing;
  user-select: none;
}

.document-tabs.tab-list-dragging .document-tab {
  cursor: grabbing;
}

:global(.tab-drag-fallback) {
  opacity: 0.96 !important;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--accent) 48%, var(--border-color)) !important;
  border-radius: 5px;
  color: var(--text-primary) !important;
  background: var(--panel-bg) !important;
  box-shadow:
    0 12px 30px color-mix(in srgb, #000 30%, transparent),
    0 2px 8px color-mix(in srgb, #000 18%, transparent) !important;
  cursor: grabbing !important;
  pointer-events: none !important;
}

:global(.tab-drag-fallback::after) {
  background: var(--accent) !important;
}

:global(.tab-drag-fallback .close-button) {
  opacity: 0.65 !important;
}

.new-document-button {
  width: 34px;
  height: 33px;
  display: grid;
  place-items: center;
  flex: 0 0 34px;
  padding: 0;
  border: 0;
  border-left: 1px solid var(--border-color);
  color: var(--text-muted);
  background: var(--tabs-bg);
  cursor: default;

  &:hover:not(:disabled),
  &:focus-visible {
    color: var(--text-primary);
    background: var(--control-hover);
    outline: none;
  }

  &:disabled { opacity: 0.45; }
  :deep(.toolbar-icon) { width: 16px; height: 16px; }
}

.tab-label {
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 5px;
  overflow: hidden;
}

.filename,
.parent-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filename { min-width: 34px; font-size: 11px; }
.parent-name { max-width: 82px; color: var(--text-muted); font-size: 9px; }
.modified-dot { width: 6px; height: 6px; flex: 0 0 auto; border-radius: 50%; background: var(--accent); }

.close-button {
  width: 21px;
  height: 21px;
  display: grid;
  place-items: center;
  margin-left: auto;
  flex: 0 0 auto;
  border-radius: 3px;
  opacity: 0;

  &:hover,
  &:focus-visible {
    opacity: 1;
    color: var(--danger);
    background: color-mix(in srgb, var(--danger) 12%, transparent);
    outline: none;
  }

  :deep(.toolbar-icon) { width: 13px; height: 13px; }
}

.document-tab:hover .close-button,
.document-tab.active .close-button { opacity: 1; }

.tab-context-menu {
  position: fixed;
  z-index: 180;
  width: 232px;
  padding: 5px;
  border: 1px solid var(--menu-popup-border);
  border-radius: 5px;
  color: var(--menu-text);
  background: var(--menu-popup-bg);
  box-shadow: var(--popup-shadow);
  font-family: "Segoe UI", var(--font-sans);
  font-size: 12px;
}

.context-menu-item {
  width: 100%;
  min-height: 30px;
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  padding: 0 9px;
  border: 0;
  border-radius: 3px;
  color: inherit;
  background: transparent;
  text-align: left;
  cursor: default;

  &:hover:not(:disabled),
  &:focus-visible:not(:disabled) {
    color: var(--menu-selection-text);
    background: var(--menu-selection-bg);
    outline: none;
  }

  &:disabled {
    opacity: 0.45;
  }

  :deep(.toolbar-icon) {
    width: 15px;
    height: 15px;
  }

  kbd {
    color: var(--text-muted);
    font-family: inherit;
    font-size: 10px;
  }

  &:hover:not(:disabled) kbd,
  &:focus-visible:not(:disabled) kbd {
    color: inherit;
  }
}

.context-menu-separator {
  height: 1px;
  margin: 4px 7px;
  background: var(--border-color);
}
</style>
