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
}>();

const emit = defineEmits<{
  'update:mode': [mode: EditorMode];
  'update:preview-theme': [theme: PreviewThemeName];
  'update:code-theme': [theme: CodeThemeName];
  'toggle-toc': [];
}>();

const viewModes: { mode: EditorMode; icon: ToolbarIconName; label: string }[] = [
  { mode: 'preview', icon: 'preview', label: '仅预览' },
  { mode: 'split', icon: 'split', label: '编辑与预览' },
  { mode: 'editor', icon: 'editor', label: '仅编辑' }
];
</script>

<template>
  <div class="editor-view-controls">
    <PreviewThemeDropdown :model-value="previewTheme" @update:model-value="emit('update:preview-theme', $event)" />
    <CodeThemeDropdown :model-value="codeTheme" @update:model-value="emit('update:code-theme', $event)" />
    <span class="divider" aria-hidden="true" />
    <button
      type="button"
      class="tool-button"
      :class="{ active: mode !== 'editor' && tocOpen }"
      :disabled="mode === 'editor'"
      :title="mode === 'editor' ? '切换到预览后可显示目录' : '显示或隐藏目录'"
      aria-label="显示或隐藏目录"
      @click="emit('toggle-toc')"
    ><ToolbarIcon name="toc" /></button>
    <div class="view-mode-group" role="group" aria-label="文档视图模式">
      <button
        v-for="view in viewModes"
        :key="view.mode"
        type="button"
        class="tool-button"
        :class="{ active: mode === view.mode }"
        :title="view.label"
        :aria-label="`切换到${view.label}`"
        @click="emit('update:mode', view.mode)"
      ><ToolbarIcon :name="view.icon" /></button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.editor-view-controls { display: flex; align-items: center; gap: 2px; min-width: 0; }
.tool-button { width: 28px; height: 28px; flex: 0 0 28px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 4px; color: var(--text-secondary); background: transparent; cursor: pointer; }
.tool-button:hover, .tool-button:focus-visible, .tool-button.active { color: var(--text-primary); background: var(--control-hover); outline: none; }
.tool-button.active { color: var(--accent); box-shadow: inset 0 -2px 0 var(--accent); }
.tool-button:disabled { opacity: 0.4; cursor: not-allowed; background: transparent; box-shadow: none; }
.view-mode-group { display: flex; flex: 0 0 auto; gap: 2px; padding: 1px; border: 1px solid var(--border-subtle); border-radius: 6px; }
.divider { width: 1px; height: 20px; margin: 0 3px; flex: 0 0 auto; background: var(--border-color); }
</style>
