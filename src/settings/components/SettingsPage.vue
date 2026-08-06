<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import {
  chooseDirectory,
  scheduleWebviewCacheCleanup
} from '@/filesystem/fileSystemService';
import { useEditorStore } from '@/store/editor';
import { useSettingsStore } from '@/store/settings';
import { listCodeThemes, listPreviewThemes } from '@/themes/themeRegistry';

type SettingsSection = 'appearance' | 'editor' | 'files' | 'markdown';

interface NavigationItem {
  id: SettingsSection;
  label: string;
  description: string;
}

const emit = defineEmits<{ close: [] }>();
const editorStore = useEditorStore();
const settingsStore = useSettingsStore();
const route = useRoute();
const router = useRouter();
const { activeDocument, theme, previewTheme, codeTheme } = storeToRefs(editorStore);
const {
  rememberWindowState,
  newFileDirectory,
  imageSaveMode,
  imageSubdirectory,
  customImageDirectory,
  monaco
} = storeToRefs(settingsStore);
const previewThemes = listPreviewThemes();
const codeThemes = listCodeThemes();
const cacheCleanupBusy = ref(false);
const cacheCleanupMessage = ref('');
const cacheCleanupFailed = ref(false);
const navigationItems: NavigationItem[] = [
  { id: 'appearance', label: '外观', description: '主题与阅读样式' },
  { id: 'editor', label: '编辑器', description: 'Monaco 编辑体验' },
  { id: 'files', label: '文件', description: '新建与保存位置' },
  { id: 'markdown', label: 'Markdown', description: '图片资源设置' }
];
const validSections = new Set<SettingsSection>(navigationItems.map((item) => item.id));
const activeSection = computed<SettingsSection>(() => {
  const section = route.params.section;
  return typeof section === 'string' && validSections.has(section as SettingsSection)
    ? (section as SettingsSection)
    : 'appearance';
});
const activeNavigation = computed(
  () => navigationItems.find((item) => item.id === activeSection.value) ?? navigationItems[0]
);
const resolvedImageDirectory = computed(() => {
  const resolved = settingsStore.resolveImageDirectory(activeDocument.value?.path ?? null);
  if (resolved) return resolved;
  return imageSaveMode.value === 'custom'
    ? '请选择自定义图片保存目录'
    : '请先保存当前 Markdown 文件';
});

watch(
  () => route.params.section,
  (section) => {
    if (typeof section === 'string' && validSections.has(section as SettingsSection)) return;
    void router.replace({ name: 'settings', params: { section: 'appearance' } });
  },
  { immediate: true }
);

function selectSection(section: SettingsSection): void {
  if (section === activeSection.value) return;
  void router.push({ name: 'settings', params: { section } });
}

async function selectCustomDirectory(): Promise<void> {
  const selected = await chooseDirectory(customImageDirectory.value || undefined);
  if (selected) settingsStore.setCustomImageDirectory(selected);
}

async function selectNewFileDirectory(): Promise<void> {
  const selected = await chooseDirectory(newFileDirectory.value || undefined);
  if (selected) settingsStore.setNewFileDirectory(selected);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = bytes / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size >= 100 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
}

async function clearWebviewCache(): Promise<void> {
  cacheCleanupBusy.value = true;
  cacheCleanupMessage.value = '';
  cacheCleanupFailed.value = false;
  try {
    const estimatedBytes = await scheduleWebviewCacheCleanup();
    const sizeMessage = estimatedBytes > 0 ? `约 ${formatFileSize(estimatedBytes)} ` : '';
    cacheCleanupMessage.value = `已安排清理${sizeMessage}缓存，完全退出并再次启动应用后生效。`;
  } catch (error) {
    cacheCleanupFailed.value = true;
    cacheCleanupMessage.value = `安排缓存清理失败：${error instanceof Error ? error.message : String(error)}`;
  } finally {
    cacheCleanupBusy.value = false;
  }
}
</script>

<template>
  <section class="settings-page" aria-label="设置">
    <aside class="settings-sidebar">
      <div class="settings-brand">
        <strong>设置</strong>
        <span>MD Code</span>
      </div>

      <nav class="settings-navigation" aria-label="设置目录">
        <button
          v-for="item in navigationItems"
          :key="item.id"
          type="button"
          :class="{ active: activeSection === item.id }"
          :aria-current="activeSection === item.id ? 'page' : undefined"
          @click="selectSection(item.id)"
        >
          <span>{{ item.label }}</span>
          <small>{{ item.description }}</small>
        </button>
      </nav>
    </aside>

    <div class="settings-main">
      <header class="settings-header">
        <div>
          <h1>{{ activeNavigation.label }}</h1>
          <p>{{ activeNavigation.description }}</p>
        </div>
        <button type="button" class="close-settings" @click="emit('close')">返回编辑器</button>
      </header>

      <div class="settings-content">
        <section v-if="activeSection === 'appearance'" class="settings-card">
          <div class="section-heading">
            <h2>界面与预览</h2>
            <p>应用主题与 Markdown 阅读样式立即生效。</p>
          </div>

          <label class="setting-row">
            <span class="setting-copy">
              <strong>应用主题</strong>
              <small>可固定浅色、深色或跟随系统。</small>
            </span>
            <select
              :value="theme"
              @change="
                editorStore.setTheme(
                  ($event.target as HTMLSelectElement).value as typeof theme
                )
              "
            >
              <option value="light">浅色</option>
              <option value="dark">深色</option>
              <option value="system">跟随系统</option>
            </select>
          </label>

          <label class="setting-row">
            <span class="setting-copy">
              <strong>预览主题</strong>
              <small>使用 Markdown 主题包改变正文阅读样式。</small>
            </span>
            <select
              :value="previewTheme"
              @change="
                editorStore.setPreviewTheme(($event.target as HTMLSelectElement).value)
              "
            >
              <option v-for="item in previewThemes" :key="item.id" :value="item.id">
                {{ item.label }}
              </option>
            </select>
          </label>

          <label class="setting-row">
            <span class="setting-copy">
              <strong>代码高亮主题</strong>
              <small>改变 Markdown 代码块的 Highlight 配色。</small>
            </span>
            <select
              :value="codeTheme"
              @change="editorStore.setCodeTheme(($event.target as HTMLSelectElement).value)"
            >
              <option v-for="item in codeThemes" :key="item.id" :value="item.id">
                {{ item.label }}
              </option>
            </select>
          </label>

          <label class="toggle-row">
            <span class="setting-copy">
              <strong>自动保存窗口大小与位置</strong>
              <small>下次启动时恢复上次非最大化状态下的窗口尺寸和屏幕位置。</small>
            </span>
            <input v-model="rememberWindowState" type="checkbox" />
          </label>
        </section>

        <template v-else-if="activeSection === 'editor'">
          <section class="settings-card">
            <div class="section-heading with-action">
              <div>
                <h2>Monaco Editor</h2>
                <p>这些选项实时应用于当前和后续打开的文档。</p>
              </div>
              <button type="button" class="secondary-button" @click="settingsStore.resetMonacoSettings">
                恢复默认
              </button>
            </div>

            <label class="setting-row">
              <span class="setting-copy">
                <strong>字体大小</strong>
                <small>编辑区代码文字大小，范围 10–32。</small>
              </span>
              <input v-model.number="monaco.fontSize" type="number" min="10" max="32" />
            </label>

            <label class="setting-row">
              <span class="setting-copy">
                <strong>行高</strong>
                <small>编辑区每一行的高度，范围 16–48。</small>
              </span>
              <input v-model.number="monaco.lineHeight" type="number" min="16" max="48" />
            </label>

            <label class="setting-row">
              <span class="setting-copy">
                <strong>Tab 宽度</strong>
                <small>按 Tab 或自动格式化时使用的缩进宽度。</small>
              </span>
              <select v-model.number="monaco.tabSize">
                <option :value="2">2 个空格</option>
                <option :value="4">4 个空格</option>
                <option :value="8">8 个空格</option>
              </select>
            </label>

            <label class="setting-row">
              <span class="setting-copy">
                <strong>自动换行</strong>
                <small>“按语言”会仅为 Markdown 默认开启换行。</small>
              </span>
              <select v-model="monaco.wordWrap">
                <option value="language">按语言</option>
                <option value="on">始终开启</option>
                <option value="off">始终关闭</option>
              </select>
            </label>

            <label class="setting-row">
              <span class="setting-copy">
                <strong>显示空白字符</strong>
                <small>控制空格和制表符的可视化范围。</small>
              </span>
              <select v-model="monaco.renderWhitespace">
                <option value="none">不显示</option>
                <option value="selection">仅选区</option>
                <option value="boundary">边界</option>
                <option value="trailing">行尾</option>
                <option value="all">全部</option>
              </select>
            </label>
          </section>

          <section class="settings-card compact-card">
            <div class="section-heading">
              <h2>编辑体验</h2>
              <p>控制滚动、缩略图和辅助导航。</p>
            </div>

            <label class="toggle-row">
              <span class="setting-copy">
                <strong>文档末尾额外空白</strong>
                <small>允许最后一行继续向上滚动，编辑器底部保留约一页空间。</small>
              </span>
              <input v-model="monaco.scrollBeyondLastLine" type="checkbox" />
            </label>

            <label class="toggle-row">
              <span class="setting-copy">
                <strong>代码缩略图</strong>
                <small>在编辑器右侧显示 Minimap。</small>
              </span>
              <input v-model="monaco.minimap" type="checkbox" />
            </label>

            <label class="toggle-row">
              <span class="setting-copy">
                <strong>粘性滚动</strong>
                <small>滚动时在顶部保留当前代码作用域。</small>
              </span>
              <input v-model="monaco.stickyScroll" type="checkbox" />
            </label>

            <label class="toggle-row">
              <span class="setting-copy">
                <strong>平滑滚动</strong>
                <small>使用动画过渡编辑器滚动位置。</small>
              </span>
              <input v-model="monaco.smoothScrolling" type="checkbox" />
            </label>

            <label class="toggle-row">
              <span class="setting-copy">
                <strong>自动检测缩进</strong>
                <small>根据文件内容推断 Tab 宽度；关闭后固定使用上方设置。</small>
              </span>
              <input v-model="monaco.detectIndentation" type="checkbox" />
            </label>

            <label class="toggle-row">
              <span class="setting-copy">
                <strong>字体连字</strong>
                <small>字体支持时合并箭头等连续字符。</small>
              </span>
              <input v-model="monaco.fontLigatures" type="checkbox" />
            </label>
          </section>
        </template>

        <template v-else-if="activeSection === 'files'">
          <section class="settings-card">
            <div class="section-heading">
              <h2>新建文件</h2>
              <p>设置新建文档第一次保存时默认打开的位置。</p>
            </div>

            <label class="setting-row">
              <span class="setting-copy">
                <strong>新建文件默认目录</strong>
                <small>留空时使用系统上一次选择的目录。</small>
              </span>
              <div class="path-picker setting-path-picker">
                <input
                  type="text"
                  :value="newFileDirectory"
                  placeholder="使用系统默认目录"
                  @input="
                    settingsStore.setNewFileDirectory(
                      ($event.target as HTMLInputElement).value
                    )
                  "
                />
                <button type="button" @click.prevent="selectNewFileDirectory">浏览...</button>
              </div>
            </label>
          </section>

          <section class="settings-card compact-card">
            <div class="section-heading with-action">
              <div>
                <h2>存储与缓存</h2>
                <p>清除 WebView 浏览器内核生成的临时缓存，释放磁盘空间。</p>
              </div>
              <button
                type="button"
                class="secondary-button"
                :disabled="cacheCleanupBusy"
                @click="clearWebviewCache"
              >
                {{ cacheCleanupBusy ? '正在处理…' : '清除 WebView 缓存' }}
              </button>
            </div>

            <div class="cache-cleanup-note">
              <strong>用户数据会保留</strong>
              <small>
                不会删除应用设置、最近文件、编辑状态、Local Storage、IndexedDB、文档或图片。缓存将在下次启动 WebView 前安全清理。
              </small>
              <small>可再生成缓存超过 128 MB 时，应用也会在启动前自动清理。</small>
              <small
                v-if="cacheCleanupMessage"
                class="cache-cleanup-status"
                :class="{ failed: cacheCleanupFailed }"
              >
                {{ cacheCleanupMessage }}
              </small>
            </div>
          </section>
        </template>

        <section v-else class="settings-card">
          <div class="section-heading">
            <h2>Markdown 图片</h2>
            <p>上传或裁剪图片时保存为实体文件，不嵌入超长 Data URL。</p>
          </div>

          <label class="radio-row">
            <input
              type="radio"
              name="image-save-mode"
              value="document"
              :checked="imageSaveMode === 'document'"
              @change="settingsStore.setImageSaveMode('document')"
            />
            <span>
              <strong>当前文档目录下的子文件夹</strong>
              <small>图片使用相对路径，项目移动后仍可显示。</small>
            </span>
          </label>

          <div class="indent-setting" :class="{ disabled: imageSaveMode !== 'document' }">
            <label for="image-subdirectory">子文件夹名称</label>
            <input
              id="image-subdirectory"
              type="text"
              :disabled="imageSaveMode !== 'document'"
              :value="imageSubdirectory"
              placeholder="images"
              @input="
                settingsStore.setImageSubdirectory(
                  ($event.target as HTMLInputElement).value
                )
              "
            />
          </div>

          <label class="radio-row">
            <input
              type="radio"
              name="image-save-mode"
              value="custom"
              :checked="imageSaveMode === 'custom'"
              @change="settingsStore.setImageSaveMode('custom')"
            />
            <span>
              <strong>自定义图片目录</strong>
              <small>所有文档的图片保存到同一个指定目录。</small>
            </span>
          </label>

          <div class="path-picker" :class="{ disabled: imageSaveMode !== 'custom' }">
            <input
              type="text"
              :disabled="imageSaveMode !== 'custom'"
              :value="customImageDirectory"
              placeholder="选择图片保存目录"
              @input="
                settingsStore.setCustomImageDirectory(
                  ($event.target as HTMLInputElement).value
                )
              "
            />
            <button
              type="button"
              :disabled="imageSaveMode !== 'custom'"
              @click="selectCustomDirectory"
            >
              浏览...
            </button>
          </div>

          <div class="resolved-path">
            <span>当前目标目录</span>
            <code>{{ resolvedImageDirectory }}</code>
          </div>
        </section>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.settings-page {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-columns: 188px minmax(0, 1fr);
  overflow: hidden;
  color: var(--text-primary);
  background: var(--panel-muted);
}

.settings-sidebar {
  min-height: 0;
  padding: 18px 10px;
  border-right: 1px solid var(--border-color);
  background: var(--panel-bg);
}

.settings-brand {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 0 10px 16px;

  strong { font-size: 17px; font-weight: 650; }
  span { color: var(--text-muted); font-size: 10px; }
}

.settings-navigation {
  display: grid;
  gap: 3px;

  button {
    width: 100%;
    display: flex;
    align-items: flex-start;
    flex-direction: column;
    gap: 3px;
    padding: 10px 11px;
    border: 0;
    border-radius: 5px;
    color: var(--text-secondary);
    background: transparent;
    text-align: left;
    cursor: pointer;

    span { font-size: 12px; font-weight: 600; }
    small { color: var(--text-muted); font-size: 9.5px; }

    &:hover { background: var(--control-hover); }

    &.active {
      color: var(--menu-selection-text);
      background: var(--menu-selection-bg);

      small { color: currentColor; opacity: 0.7; }
    }
  }
}

.settings-main {
  min-width: 0;
  min-height: 0;
  overflow: auto;
}

.settings-header {
  position: sticky;
  z-index: 5;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 17px clamp(22px, 4vw, 54px) 14px;
  border-bottom: 1px solid var(--border-color);
  background: color-mix(in srgb, var(--panel-bg) 94%, transparent);
  backdrop-filter: blur(10px);

  h1 { margin: 0; font-size: 20px; font-weight: 650; }
  p { margin: 3px 0 0; color: var(--text-muted); font-size: 11px; }
}

.close-settings,
.secondary-button,
.path-picker button {
  min-height: 30px;
  padding: 0 13px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-primary);
  background: var(--panel-bg);
  font-size: 11px;
  cursor: pointer;

  &:hover:not(:disabled) { border-color: var(--accent); background: var(--control-hover); }
  &:disabled { opacity: 0.5; cursor: default; }
}

.settings-content {
  width: min(860px, calc(100% - 36px));
  display: grid;
  gap: 16px;
  margin: 20px auto 54px;
}

.settings-card {
  padding: 3px 20px 14px;
  border: 1px solid var(--border-color);
  border-radius: 7px;
  background: var(--panel-bg);
  box-shadow: 0 2px 9px color-mix(in srgb, #000 6%, transparent);
}

.section-heading {
  padding: 16px 0 12px;
  border-bottom: 1px solid var(--border-subtle);

  h2 { margin: 0; font-size: 14px; font-weight: 650; }
  p { margin: 4px 0 0; color: var(--text-muted); font-size: 10.5px; }

  &.with-action {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
  }
}

.setting-row,
.toggle-row {
  min-height: 60px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 190px;
  align-items: center;
  gap: 24px;
  border-bottom: 1px solid var(--border-subtle);

  &:last-child { border-bottom: 0; }
}

.toggle-row {
  grid-template-columns: minmax(0, 1fr) auto;

  > input {
    width: 16px;
    height: 16px;
    accent-color: var(--accent);
  }
}

.setting-copy,
.radio-row > span {
  display: flex;
  flex-direction: column;
  gap: 3px;

  strong { font-size: 11.5px; font-weight: 600; }
  small { color: var(--text-muted); font-size: 10px; line-height: 1.45; }
}

select,
input[type='text'],
input[type='number'] {
  width: 100%;
  height: 30px;
  padding: 0 9px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-primary);
  background: var(--panel-bg);
  font-size: 11px;
  outline: none;

  &:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 15%, transparent);
  }

  &:disabled { opacity: 0.55; }
}

.radio-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 16px;
  cursor: pointer;

  input { margin-top: 2px; accent-color: var(--accent); }
}

.indent-setting,
.path-picker {
  margin: 12px 0 4px 27px;
  transition: opacity 0.15s ease;

  &.disabled { opacity: 0.58; }
}

.setting-path-picker {
  width: min(430px, 100%);
  margin: 0;
}

.indent-setting {
  display: grid;
  grid-template-columns: 120px minmax(180px, 340px);
  align-items: center;
  gap: 12px;

  label { color: var(--text-secondary); font-size: 11px; }
}

.path-picker {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.resolved-path {
  display: grid;
  gap: 6px;
  margin: 18px 0 4px;
  padding: 12px;
  border-radius: 4px;
  color: var(--text-secondary);
  background: var(--panel-muted);
  font-size: 10.5px;

  code {
    color: var(--text-primary);
    font-family: var(--font-mono);
    overflow-wrap: anywhere;
  }
}

.cache-cleanup-note {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 14px 0 4px;

  strong { font-size: 11.5px; font-weight: 600; }
  small { color: var(--text-muted); font-size: 10px; line-height: 1.5; }
}

.cache-cleanup-status {
  color: var(--accent) !important;

  &.failed { color: #c42b1c !important; }
}

@media (max-width: 720px) {
  .settings-page { grid-template-columns: 1fr; grid-template-rows: auto minmax(0, 1fr); }
  .settings-sidebar { padding: 9px 12px; border-right: 0; border-bottom: 1px solid var(--border-color); }
  .settings-brand { display: none; }
  .settings-navigation { display: flex; overflow-x: auto; }
  .settings-navigation button { min-width: 116px; }
  .setting-row { grid-template-columns: 1fr; gap: 8px; padding: 12px 0; }
  .indent-setting { grid-template-columns: 1fr; }
}
</style>
