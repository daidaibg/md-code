<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { chooseDirectory } from '@/filesystem/fileSystemService';
import { useEditorStore } from '@/store/editor';
import { useSettingsStore } from '@/store/settings';
import { listCodeThemes, listPreviewThemes } from '@/themes/themeRegistry';

const emit = defineEmits<{ close: [] }>();
const editorStore = useEditorStore();
const settingsStore = useSettingsStore();
const { activeDocument, theme, previewTheme, codeTheme } = storeToRefs(editorStore);
const { newFileDirectory, imageSaveMode, imageSubdirectory, customImageDirectory } =
  storeToRefs(settingsStore);
const previewThemes = listPreviewThemes();
const codeThemes = listCodeThemes();
const resolvedImageDirectory = computed(() => {
  const resolved = settingsStore.resolveImageDirectory(activeDocument.value?.path ?? null);
  if (resolved) return resolved;
  return imageSaveMode.value === 'custom'
    ? '请选择自定义图片保存目录'
    : '请先保存当前 Markdown 文件';
});

async function selectCustomDirectory(): Promise<void> {
  const selected = await chooseDirectory(customImageDirectory.value || undefined);
  if (selected) settingsStore.setCustomImageDirectory(selected);
}

async function selectNewFileDirectory(): Promise<void> {
  const selected = await chooseDirectory(newFileDirectory.value || undefined);
  if (selected) settingsStore.setNewFileDirectory(selected);
}
</script>

<template>
  <section class="settings-page" aria-label="设置">
    <header class="settings-header">
      <div>
        <h1>设置</h1>
        <p>外观、文件与 Markdown 图片保存选项</p>
      </div>
      <button type="button" class="close-settings" @click="emit('close')">关闭</button>
    </header>

    <div class="settings-content">
      <section class="settings-card">
        <div class="section-heading">
          <h2>外观</h2>
          <p>应用主题与 Markdown 阅读样式立即生效。</p>
        </div>

        <label class="setting-row">
          <span class="setting-copy"><strong>应用主题</strong><small>可固定浅色、深色或跟随系统。</small></span>
          <select :value="theme" @change="editorStore.setTheme(($event.target as HTMLSelectElement).value as typeof theme)">
            <option value="light">浅色</option>
            <option value="dark">深色</option>
            <option value="system">跟随系统</option>
          </select>
        </label>

        <label class="setting-row">
          <span class="setting-copy"><strong>预览主题</strong><small>使用 md-editor-v3 官方 Markdown 主题包。</small></span>
          <select :value="previewTheme" @change="editorStore.setPreviewTheme(($event.target as HTMLSelectElement).value)">
            <option v-for="item in previewThemes" :key="item.id" :value="item.id">{{ item.label }}</option>
          </select>
        </label>

        <label class="setting-row">
          <span class="setting-copy"><strong>代码主题</strong><small>自动匹配当前应用的浅色或深色模式。</small></span>
          <select :value="codeTheme" @change="editorStore.setCodeTheme(($event.target as HTMLSelectElement).value)">
            <option v-for="item in codeThemes" :key="item.id" :value="item.id">{{ item.label }}</option>
          </select>
        </label>
      </section>

      <section class="settings-card">
        <div class="section-heading">
          <h2>文件</h2>
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
              @input="settingsStore.setNewFileDirectory(($event.target as HTMLInputElement).value)"
            />
            <button type="button" @click.prevent="selectNewFileDirectory">浏览...</button>
          </div>
        </label>
      </section>

      <section class="settings-card">
        <div class="section-heading">
          <h2>Markdown 图片</h2>
          <p>上传或裁剪图片时保存为实体文件，不再嵌入超长 Data URL。</p>
        </div>

        <label class="radio-row">
          <input
            type="radio"
            name="image-save-mode"
            value="document"
            :checked="imageSaveMode === 'document'"
            @change="settingsStore.setImageSaveMode('document')"
          />
          <span><strong>当前文档目录下的子文件夹</strong><small>推荐。图片链接使用相对路径，项目移动后仍可显示。</small></span>
        </label>

        <div class="indent-setting" :class="{ disabled: imageSaveMode !== 'document' }">
          <label for="image-subdirectory">子文件夹名称</label>
          <input
            id="image-subdirectory"
            type="text"
            :disabled="imageSaveMode !== 'document'"
            :value="imageSubdirectory"
            placeholder="images"
            @input="settingsStore.setImageSubdirectory(($event.target as HTMLInputElement).value)"
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
          <span><strong>自定义图片目录</strong><small>所有文档的图片保存到同一个指定目录。</small></span>
        </label>

        <div class="path-picker" :class="{ disabled: imageSaveMode !== 'custom' }">
          <input
            type="text"
            :disabled="imageSaveMode !== 'custom'"
            :value="customImageDirectory"
            placeholder="选择图片保存目录"
            @input="settingsStore.setCustomImageDirectory(($event.target as HTMLInputElement).value)"
          />
          <button type="button" :disabled="imageSaveMode !== 'custom'" @click="selectCustomDirectory">浏览...</button>
        </div>

        <div class="resolved-path">
          <span>当前目标目录</span>
          <code>{{ resolvedImageDirectory }}</code>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped lang="scss">
.settings-page {
  height: 100%;
  overflow: auto;
  color: var(--text-primary);
  background: var(--panel-muted);
}

.settings-header {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px clamp(24px, 5vw, 64px) 16px;
  border-bottom: 1px solid var(--border-color);
  background: color-mix(in srgb, var(--panel-bg) 94%, transparent);
  backdrop-filter: blur(10px);

  h1 { margin: 0; font-size: 22px; font-weight: 650; }
  p { margin: 4px 0 0; color: var(--text-muted); font-size: 12px; }
}

.close-settings,
.path-picker button {
  min-height: 30px;
  padding: 0 13px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-primary);
  background: var(--panel-bg);
  font-size: 12px;
  cursor: pointer;

  &:hover:not(:disabled) { border-color: var(--accent); background: var(--control-hover); }
  &:disabled { opacity: 0.5; cursor: default; }
}

.settings-content {
  width: min(900px, calc(100% - 40px));
  display: grid;
  gap: 18px;
  margin: 24px auto 60px;
}

.settings-card {
  padding: 4px 22px 16px;
  border: 1px solid var(--border-color);
  border-radius: 7px;
  background: var(--panel-bg);
  box-shadow: 0 2px 9px color-mix(in srgb, #000 6%, transparent);
}

.section-heading {
  padding: 18px 0 13px;
  border-bottom: 1px solid var(--border-subtle);

  h2 { margin: 0; font-size: 15px; font-weight: 650; }
  p { margin: 5px 0 0; color: var(--text-muted); font-size: 11px; }
}

.setting-row {
  min-height: 62px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 190px;
  align-items: center;
  gap: 24px;
  border-bottom: 1px solid var(--border-subtle);

  &:last-child { border-bottom: 0; }
}

.setting-copy,
.radio-row > span {
  display: flex;
  flex-direction: column;
  gap: 3px;

  strong { font-size: 12px; font-weight: 600; }
  small { color: var(--text-muted); font-size: 10.5px; line-height: 1.45; }
}

select,
input[type='text'] {
  width: 100%;
  height: 30px;
  padding: 0 9px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-primary);
  background: var(--panel-bg);
  font-size: 11px;
  outline: none;

  &:focus { border-color: var(--accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 15%, transparent); }
  &:disabled { opacity: 0.55; }
}

.radio-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 17px;
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

  code { color: var(--text-primary); font-family: var(--font-mono); overflow-wrap: anywhere; }
}

@media (max-width: 680px) {
  .setting-row { grid-template-columns: 1fr; gap: 8px; padding: 13px 0; }
  .indent-setting { grid-template-columns: 1fr; }
}
</style>
