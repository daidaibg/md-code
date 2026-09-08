<script setup lang="ts">
import ToolbarIcon from '@/components/icons/ToolbarIcon.vue';
import CodeThemeDropdown from '@/themes/components/CodeThemeDropdown.vue';
import PreviewThemeDropdown from '@/themes/components/PreviewThemeDropdown.vue';
import type { CodeThemeName, EditorMode, PreviewThemeName, ToolbarIconName } from '@/types/editor';

defineProps<{
  mode: EditorMode;
  tocOpen: boolean;
  previewTheme: PreviewThemeName;
  codeTheme: CodeThemeName;
  visual?: boolean;
  showEditorSwitch?: boolean;
}>();

const emit = defineEmits<{
  'update:visual': [visual: boolean];
  'update:mode': [mode: EditorMode];
  'update:preview-theme': [theme: PreviewThemeName];
  'update:code-theme': [theme: CodeThemeName];
  'toggle-toc': [];
}>();

const viewModes: { mode: EditorMode; icon: ToolbarIconName; label: string }[] = [
  { mode: 'split', icon: 'split', label: '编辑与预览' },
  { mode: 'editor', icon: 'editor', label: '仅编辑' },
  { mode: 'preview', icon: 'preview', label: '仅预览' }
];
</script>

<template>
  <div class="editor-view-controls">
    <div v-if="showEditorSwitch" class="editor-kind-switch" role="group" aria-label="编辑方式">
      <button type="button" :class="{ selected: visual }" :aria-pressed="!!visual" @click="emit('update:visual', true)">可视化</button>
      <button type="button" :class="{ selected: !visual }" :aria-pressed="!visual" @click="emit('update:visual', false)">源码</button>
    </div>
    <span v-if="showEditorSwitch" class="divider" aria-hidden="true" />
    <PreviewThemeDropdown :model-value="previewTheme" @update:model-value="emit('update:preview-theme', $event)" />
    <span class="divider" aria-hidden="true" />
    <CodeThemeDropdown :model-value="codeTheme" @update:model-value="emit('update:code-theme', $event)" />
    <span class="controls-spacer" />
    <span class="divider" aria-hidden="true" />
    <button
      type="button"
      class="tool-button"
      :class="{ active: (visual || mode !== 'editor') && tocOpen }"
      :disabled="!visual && mode === 'editor'"
      :title="!visual && mode === 'editor' ? '切换到预览后可显示目录' : '显示或隐藏目录'"
      :aria-pressed="(visual || mode !== 'editor') && tocOpen"
      aria-label="显示或隐藏目录"
      @click="emit('toggle-toc')"
    ><ToolbarIcon name="toc" /></button>
    <button
      v-if="visual"
      type="button"
      class="tool-button visual-preview-button"
      :class="{ active: mode === 'preview' }"
      :title="mode === 'preview' ? '返回可视化编辑' : '预览 Markdown'"
      :aria-pressed="mode === 'preview'"
      @click="emit('update:mode', mode === 'preview' ? 'editor' : 'preview')"
    ><ToolbarIcon name="preview" /><span>预览</span></button>
    <div v-else class="view-mode-group" role="group" aria-label="文档视图模式">
      <button
        v-for="view in viewModes"
        :key="view.mode"
        type="button"
        class="tool-button"
        :class="{ active: mode === view.mode }"
        :aria-pressed="mode === view.mode"
        :title="view.label"
        :aria-label="`切换到${view.label}`"
        @click="emit('update:mode', view.mode)"
      ><ToolbarIcon :name="view.icon" /><span v-if="view.mode === 'preview'">预览</span></button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.editor-view-controls { display: flex; align-items: center; gap: 2px; min-width: 0; }
.editor-kind-switch { display: flex; gap: 0; flex-shrink: 0; height: 26px; box-sizing: border-box; padding: 1px; margin-right: 4px; border: 1px solid var(--border-color); border-radius: 999px; background: color-mix(in srgb, var(--text-primary) 3%, var(--panel-bg)); }
.editor-kind-switch button { min-width: 56px; height: 22px; padding: 0 12px; font-size: 12px; line-height: 1; border: 1px solid transparent; border-radius: 999px; background: transparent; color: var(--text-primary); cursor: pointer; transition: background-color .15s, border-color .15s, color .15s; }
.editor-kind-switch button:hover { background: color-mix(in srgb, var(--accent) 6%, var(--panel-bg)); }
.editor-kind-switch button.selected { background: color-mix(in srgb, var(--accent) 12%, var(--panel-bg)); color: var(--accent); border-color: color-mix(in srgb, var(--accent) 20%, var(--panel-bg)); font-weight: 600; }
.editor-kind-switch button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.tool-button { width: 28px; height: 28px; flex: 0 0 28px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 4px; color: var(--text-secondary); background: transparent; cursor: pointer; }
.tool-button:hover, .tool-button:focus-visible, .tool-button.active { color: var(--text-primary); background: var(--control-hover); outline: none; }
.tool-button.active { color: var(--accent); box-shadow: inset 0 -2px 0 var(--accent); }
.tool-button:disabled { opacity: 0.4; cursor: not-allowed; background: transparent; box-shadow: none; }
.visual-preview-button { display: flex; width: auto; flex-basis: auto; gap: 4px; padding: 0 7px; font-size: 12px; }
.view-mode-group { display: flex; flex: 0 0 auto; gap: 0; padding: 0; border: 1px solid var(--border-color); border-radius: 8px; background: color-mix(in srgb, var(--accent) 6%, var(--panel-bg)); }
.view-mode-group .tool-button { width: 30px; height: 26px; flex-basis: 30px; border-radius: 0; box-shadow: none; transition: background-color .15s, color .15s; }
.view-mode-group .tool-button + .tool-button { border-left: 1px solid var(--border-color); }
.view-mode-group .tool-button:first-child { border-radius: 7px 0 0 7px; }
.view-mode-group .tool-button:last-child { display: flex; justify-content: center; gap: 5px; width: auto; flex-basis: auto; padding: 0 10px; border-radius: 0 7px 7px 0; font-size: 12px; }
.view-mode-group .tool-button.active { color: var(--accent); background: color-mix(in srgb, var(--accent) 13%, var(--panel-bg)); box-shadow: none; }
.view-mode-group .tool-button:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.divider { width: 1px; height: 20px; margin: 0 3px; flex: 0 0 auto; background: var(--border-color); }
.controls-spacer { flex: 1 1 20px; }
.editor-view-controls { gap: 8px; }
.tool-button.active { box-shadow: none; background: color-mix(in srgb, var(--accent) 10%, var(--panel-bg)); }
.view-mode-group { border: 0; background: transparent; gap: 6px; }
.view-mode-group .tool-button { border-radius: 5px; }
.view-mode-group .tool-button + .tool-button { border-left: 0; }
.view-mode-group .tool-button:first-child { border-radius: 5px; }
.view-mode-group .tool-button:last-child { margin-left: 10px; border-left: 1px solid var(--border-color); border-radius: 0; padding-left: 18px; }
</style>
