<script setup lang="ts">
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { detectLanguage, languageLabel } from '@/editor/language/languageManager';
import { isTauriRuntime } from '@/filesystem/fileSystemService';
import appLogoUrl from '../../../src-tauri/icons/32x32.png';
import type { EditorMode, EditorTheme, RecentFile, SupportedLanguage } from '@/types/editor';

const props = defineProps<{
  title: string;
  theme: EditorTheme;
  busy: boolean;
  mode: EditorMode;
  language: SupportedLanguage;
  previewSupported: boolean;
  recentFiles: RecentFile[];
  appVersion: string;
}>();

const emit = defineEmits<{
  new: [];
  open: [];
  save: [];
  'save-as': [];
  close: [];
  undo: [];
  redo: [];
  search: [];
  replace: [];
  'select-all': [];
  format: [];
  'open-recent': [path: string];
  'clear-recent': [];
  'set-mode': [mode: EditorMode];
  'cycle-tab': [direction: 1 | -1];
  'set-theme': [theme: EditorTheme];
  'open-settings': [];
}>();

type MenuId = 'file' | 'edit' | 'search' | 'view' | 'settings' | 'help';
const topMenus: Array<{ id: MenuId; label: string }> = [
  { id: 'file', label: '文件(F)' },
  { id: 'edit', label: '编辑(E)' },
  { id: 'search', label: '搜索(S)' },
  { id: 'view', label: '查看(V)' },
  { id: 'settings', label: '设置(P)' },
  { id: 'help', label: '帮助(H)' }
];

const activeMenu = ref<MenuId | null>(null);
const submenu = ref<'recent' | 'appearance' | null>(null);
const menuRoot = ref<HTMLElement>();
const menuLeft = ref(8);
const maximized = ref(false);
const desktopWindow = isTauriRuntime() ? getCurrentWindow() : null;
let unlistenWindowResize: UnlistenFn | undefined;
let disposed = false;

function updateMenuPosition(target: EventTarget | null, menu: MenuId): void {
  const button = target instanceof HTMLElement ? target : null;
  const root = menuRoot.value;
  if (!button || !root) return;
  const popupWidth = menu === 'file' ? 310 : 260;
  menuLeft.value = Math.max(5, Math.min(button.offsetLeft, root.clientWidth - popupWidth - 5));
}

function toggleMenu(menu: MenuId, event: MouseEvent): void {
  updateMenuPosition(event.currentTarget, menu);
  activeMenu.value = activeMenu.value === menu ? null : menu;
  submenu.value = null;
}

function switchMenu(menu: MenuId, event: MouseEvent): void {
  if (!activeMenu.value || activeMenu.value === menu) return;
  updateMenuPosition(event.currentTarget, menu);
  activeMenu.value = menu;
  submenu.value = null;
}

function closeMenu(): void {
  activeMenu.value = null;
  submenu.value = null;
}

function run(action: () => void): void {
  closeMenu();
  action();
}

function recentLanguage(path: string): string {
  return languageLabel(detectLanguage(path));
}

function onDocumentPointerdown(event: PointerEvent): void {
  if (!menuRoot.value?.contains(event.target as Node)) closeMenu();
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') closeMenu();
}

async function syncMaximized(): Promise<void> {
  if (desktopWindow) maximized.value = await desktopWindow.isMaximized();
}

async function minimizeWindow(): Promise<void> {
  await desktopWindow?.minimize();
}

async function toggleMaximizeWindow(): Promise<void> {
  await desktopWindow?.toggleMaximize();
  await syncMaximized();
}

async function closeWindow(): Promise<void> {
  await desktopWindow?.close();
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerdown);
  document.addEventListener('keydown', onKeydown);
  if (desktopWindow) {
    void syncMaximized();
    void desktopWindow.onResized(() => void syncMaximized()).then((unlisten) => {
      if (disposed) unlisten();
      else unlistenWindowResize = unlisten;
    });
  }
});

onBeforeUnmount(() => {
  disposed = true;
  unlistenWindowResize?.();
  document.removeEventListener('pointerdown', onDocumentPointerdown);
  document.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <header
    ref="menuRoot"
    class="app-menu-bar"
    role="menubar"
    aria-label="应用菜单和窗口标题栏"
    data-tauri-drag-region
  >
    <img
      class="app-logo"
      :src="appLogoUrl"
      alt=""
      draggable="false"
      data-tauri-drag-region
    />
    <button
      v-for="menu in topMenus"
      :key="menu.id"
      type="button"
      class="menu-trigger"
      :class="{ active: activeMenu === menu.id }"
      role="menuitem"
      :aria-expanded="activeMenu === menu.id"
      @mouseenter="switchMenu(menu.id, $event)"
      @click.stop="toggleMenu(menu.id, $event)"
    >
      {{ menu.label }}
    </button>

    <div
      class="menu-title"
      :title="title"
      data-tauri-drag-region
      @dblclick="toggleMaximizeWindow"
    >
      {{ title }}
    </div>

    <div v-if="desktopWindow" class="window-controls" aria-label="窗口控制">
      <button
        type="button"
        class="window-control"
        title="最小化"
        aria-label="最小化窗口"
        @click.stop="minimizeWindow"
      >
        <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1.5 9.5h9" /></svg>
      </button>
      <button
        type="button"
        class="window-control"
        :title="maximized ? '还原' : '最大化'"
        :aria-label="maximized ? '还原窗口' : '最大化窗口'"
        @click.stop="toggleMaximizeWindow"
      >
        <svg v-if="!maximized" viewBox="0 0 12 12" aria-hidden="true">
          <rect x="1.5" y="1.5" width="9" height="9" />
        </svg>
        <svg v-else viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3.5 3.5v-2h7v7h-2M1.5 3.5h7v7h-7z" />
        </svg>
      </button>
      <button
        type="button"
        class="window-control window-close"
        title="关闭"
        aria-label="关闭窗口"
        @click.stop="closeWindow"
      >
        <svg viewBox="0 0 12 12" aria-hidden="true"><path d="m2 2 8 8M10 2l-8 8" /></svg>
      </button>
    </div>

    <div v-if="activeMenu === 'file'" class="menu-popup file-menu" :style="{ left: menuLeft + 'px' }" role="menu">
      <button type="button" class="menu-item" :disabled="busy" @click="run(() => emit('new'))">
        <span>新建文件</span><kbd>Ctrl+N</kbd>
      </button>
      <button type="button" class="menu-item" :disabled="busy" @click="run(() => emit('open'))">
        <span>打开文件...</span><kbd>Ctrl+O</kbd>
      </button>
      <div
        class="menu-item submenu-item"
        :class="{ active: submenu === 'recent' }"
        role="menuitem"
        @mouseenter="submenu = 'recent'"
        @click.stop="submenu = submenu === 'recent' ? null : 'recent'"
      >
        <span>打开最近的文件</span><span class="submenu-arrow">›</span>
        <div v-if="submenu === 'recent'" class="menu-popup recent-menu" role="menu">
          <button
            v-for="recent in props.recentFiles"
            :key="recent.path"
            type="button"
            class="menu-item recent-item"
            :title="recent.path"
            @click="run(() => emit('open-recent', recent.path))"
          >
            <span class="recent-copy">
              <strong>{{ recent.filename }}</strong>
              <small>{{ recent.path }}</small>
            </span>
            <span class="recent-kind">{{ recentLanguage(recent.path) }}</span>
          </button>
          <div v-if="props.recentFiles.length === 0" class="menu-empty">暂无最近文件</div>
          <div v-if="props.recentFiles.length" class="menu-separator" />
          <button
            v-if="props.recentFiles.length"
            type="button"
            class="menu-item"
            @click="run(() => emit('clear-recent'))"
          >
            <span>清空最近文件</span>
          </button>
        </div>
      </div>
      <div class="menu-separator" />
      <button type="button" class="menu-item" :disabled="busy" @click="run(() => emit('save'))">
        <span>保存</span><kbd>Ctrl+S</kbd>
      </button>
      <button type="button" class="menu-item" :disabled="busy" @click="run(() => emit('save-as'))">
        <span>另存为...</span><kbd>Ctrl+Shift+S</kbd>
      </button>
      <div class="menu-separator" />
      <button type="button" class="menu-item" @click="run(() => emit('close'))">
        <span>关闭当前文件</span><kbd>Ctrl+W</kbd>
      </button>
    </div>

    <div v-if="activeMenu === 'edit'" class="menu-popup" :style="{ left: menuLeft + 'px' }" role="menu">
      <button type="button" class="menu-item" @click="run(() => emit('undo'))"><span>撤销</span><kbd>Ctrl+Z</kbd></button>
      <button type="button" class="menu-item" @click="run(() => emit('redo'))"><span>重做</span><kbd>Ctrl+Y</kbd></button>
      <div class="menu-separator" />
      <button type="button" class="menu-item" @click="run(() => emit('select-all'))"><span>全选</span><kbd>Ctrl+A</kbd></button>
      <button type="button" class="menu-item" @click="run(() => emit('format'))"><span>格式化文档</span><kbd>Shift+Alt+F</kbd></button>
    </div>

    <div v-if="activeMenu === 'search'" class="menu-popup" :style="{ left: menuLeft + 'px' }" role="menu">
      <button type="button" class="menu-item" @click="run(() => emit('search'))"><span>查找</span><kbd>Ctrl+F</kbd></button>
      <button type="button" class="menu-item" @click="run(() => emit('replace'))"><span>替换</span><kbd>Ctrl+H</kbd></button>
    </div>

    <div v-if="activeMenu === 'view'" class="menu-popup" :style="{ left: menuLeft + 'px' }" role="menu">
      <button
        type="button"
        class="menu-item"
        :class="{ checked: mode === 'preview' }"
        :disabled="!previewSupported"
        @click="run(() => emit('set-mode', 'preview'))"
      ><span>仅预览</span></button>
      <button
        type="button"
        class="menu-item"
        :class="{ checked: mode === 'split' }"
        :disabled="!previewSupported"
        @click="run(() => emit('set-mode', 'split'))"
      ><span>分栏模式</span></button>
      <button
        type="button"
        class="menu-item"
        :class="{ checked: mode === 'editor' }"
        @click="run(() => emit('set-mode', 'editor'))"
      ><span>仅编辑</span></button>
      <div class="menu-separator" />
      <div
        class="menu-item submenu-item"
        :class="{ active: submenu === 'appearance' }"
        role="menuitem"
        @mouseenter="submenu = 'appearance'"
        @click.stop="submenu = submenu === 'appearance' ? null : 'appearance'"
      >
        <span>外观主题</span><span class="submenu-arrow">›</span>
        <div v-if="submenu === 'appearance'" class="menu-popup appearance-menu" role="menu">
          <button type="button" class="menu-item" :class="{ checked: theme === 'light' }" @click="run(() => emit('set-theme', 'light'))"><span>浅色</span></button>
          <button type="button" class="menu-item" :class="{ checked: theme === 'dark' }" @click="run(() => emit('set-theme', 'dark'))"><span>深色</span></button>
          <button type="button" class="menu-item" :class="{ checked: theme === 'system' }" @click="run(() => emit('set-theme', 'system'))"><span>跟随系统</span></button>
        </div>
      </div>
      <div class="menu-separator" />
      <button type="button" class="menu-item" @click="run(() => emit('cycle-tab', -1))"><span>上一个标签页</span><kbd>Ctrl+Shift+Tab</kbd></button>
      <button type="button" class="menu-item" @click="run(() => emit('cycle-tab', 1))"><span>下一个标签页</span><kbd>Ctrl+Tab</kbd></button>
    </div>

    <div v-if="activeMenu === 'settings'" class="menu-popup" :style="{ left: menuLeft + 'px' }" role="menu">
      <button type="button" class="menu-item" @click="run(() => emit('open-settings'))">
        <span>首选项...</span>
      </button>
    </div>

    <div v-if="activeMenu === 'help'" class="menu-popup" :style="{ left: menuLeft + 'px' }" role="menu">
      <div class="menu-empty version-only">v{{ appVersion }}</div>
    </div>
  </header>
</template>

<style scoped lang="scss">
.app-menu-bar {
  position: relative;
  z-index: 60;
  min-width: 0;
  height: 34px;
  display: flex;
  align-items: center;
  gap: 1px;
  padding: 0 6px;
  border-bottom: 1px solid var(--menu-border);
  color: var(--menu-text);
  background: var(--menu-bg);
  font-family: "Segoe UI", var(--font-sans);
  user-select: none;
}

.menu-trigger {
  height: 26px;
  padding: 0 8px;
  border: 0;
  border-radius: 3px;
  color: inherit;
  background: transparent;
  font-family: inherit;
  font-size: 12px;
  white-space: nowrap;
  cursor: default;

  &:hover,
  &.active {
    color: var(--menu-text-active);
    background: var(--menu-hover-bg);
  }

  &:focus-visible {
    outline: 1px solid var(--accent);
    outline-offset: -2px;
  }
}

.app-logo {
  width: 22px;
  height: 22px;
  display: block;
  margin: 0 5px 0 1px;
  flex: 0 0 auto;
  object-fit: contain;
  pointer-events: none;
}

.menu-title {
  min-width: 0;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: auto;
  overflow: hidden;
  padding: 0 9px;
  flex: 1 1 auto;
  color: var(--text-muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.window-controls {
  height: 100%;
  display: flex;
  align-self: stretch;
  margin: 0 -6px 0 0;
  flex: 0 0 auto;
}

.window-control {
  width: 46px;
  height: 100%;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 0;
  color: var(--menu-text);
  background: transparent;
  cursor: default;

  &:hover {
    color: var(--menu-text-active);
    background: var(--menu-hover-bg);
  }

  &:focus-visible {
    outline: 1px solid var(--accent);
    outline-offset: -2px;
  }

  svg {
    width: 11px;
    height: 11px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1;
    shape-rendering: crispEdges;
  }
}

.window-close:hover {
  color: #fff;
  background: #c42b1c;
}

.menu-popup {
  position: absolute;
  top: 33px;
  z-index: 90;
  width: 220px;
  padding: 4px 0;
  overflow: visible;
  border: 1px solid var(--menu-popup-border);
  border-radius: 3px;
  color: var(--menu-text);
  background: var(--menu-popup-bg);
  box-shadow: var(--popup-shadow);
}

.file-menu { width: 230px; }
.recent-menu,
.appearance-menu {
  top: -5px;
  left: calc(100% - 3px) !important;
}
.recent-menu {
  width: min(460px, calc(100vw - 330px));
  min-width: 350px;
  max-height: min(520px, calc(100vh - 48px));
  overflow-y: auto;
}
.appearance-menu { width: 170px; }

.menu-item {
  position: relative;
  width: calc(100% - 8px);
  min-height: 28px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 18px;
  margin: 0 4px;
  padding: 3px 9px;
  border: 0;
  border-radius: 2px;
  color: var(--menu-text);
  background: transparent;
  font-family: inherit;
  font-size: 12px;
  line-height: 1.35;
  text-align: left;
  cursor: default;

  &:hover:not(:disabled),
  &.active {
    color: var(--menu-selection-text);
    background: var(--menu-selection-bg);
  }

  &:disabled { color: var(--text-muted); }

  &.checked > span:first-child::before {
    content: '✓';
    display: inline-block;
    width: 18px;
    color: inherit;
  }
}

.menu-item kbd,
.recent-kind {
  color: var(--text-muted);
  font-family: inherit;
  font-size: 10px;
  font-weight: 400;
  white-space: nowrap;
}

.menu-item:hover:not(:disabled) kbd,
.menu-item:hover:not(:disabled) .recent-kind { color: inherit; }

.submenu-item { grid-template-columns: minmax(0, 1fr) auto; }
.submenu-arrow { font-size: 18px; line-height: 1; }
.recent-item { min-height: 43px; }

.recent-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
  overflow: hidden;

  strong,
  small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong { font-size: 12px; font-weight: 500; }
  small { color: var(--text-muted); font-size: 10px; }
}

.menu-empty { padding: 8px 13px; color: var(--text-muted); font-size: 11px; }
.menu-separator { height: 1px; margin: 4px 0; background: var(--menu-popup-border); }

@media (max-width: 700px) {
  .menu-title { display: none; }
  .recent-menu { width: min(400px, calc(100vw - 30px)); min-width: 290px; }
}
</style>
