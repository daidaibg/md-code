<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { monaco } from '@/editor/monaco/setupMonaco';
import type { ResolvedTheme, SupportedLanguage } from '@/types/editor';

const props = defineProps<{
  filename: string;
  localContent: string;
  diskContent: string;
  language: SupportedLanguage;
  theme: ResolvedTheme;
}>();

const emit = defineEmits<{
  back: [];
  'use-disk': [];
  'use-local': [];
  'apply-merged': [content: string];
}>();

const host = ref<HTMLDivElement>();
let diffEditor: monaco.editor.IStandaloneDiffEditor | undefined;
let diskModel: monaco.editor.ITextModel | undefined;
let mergedModel: monaco.editor.ITextModel | undefined;
let resizeObserver: ResizeObserver | undefined;

function editorTheme(): string {
  return props.theme === 'dark' ? 'vs-dark' : 'vs';
}

function updateModel(model: monaco.editor.ITextModel | undefined, value: string): void {
  if (model && model.getValue() !== value) model.setValue(value);
}

function applyMerged(): void {
  emit('apply-merged', mergedModel?.getValue() ?? props.localContent);
}

onMounted(() => {
  if (!host.value) return;
  diskModel = monaco.editor.createModel(props.diskContent, props.language);
  mergedModel = monaco.editor.createModel(props.localContent, props.language);
  diffEditor = monaco.editor.createDiffEditor(host.value, {
    theme: editorTheme(),
    automaticLayout: false,
    renderSideBySide: true,
    originalEditable: false,
    readOnly: false,
    enableSplitViewResizing: true,
    minimap: { enabled: false },
    fontFamily: 'Cascadia Code, JetBrains Mono, Consolas, monospace',
    fontSize: 13,
    lineHeight: 21,
    wordWrap: props.language === 'markdown' ? 'on' : 'off',
    scrollBeyondLastLine: false,
    renderOverviewRuler: true,
    diffWordWrap: 'inherit',
    ignoreTrimWhitespace: false,
    padding: { top: 12, bottom: 24 }
  });
  diffEditor.setModel({ original: diskModel, modified: mergedModel });
  resizeObserver = new ResizeObserver(() => diffEditor?.layout());
  resizeObserver.observe(host.value);
  void nextTick(() => diffEditor?.layout());
});

watch(
  () => props.diskContent,
  (content) => updateModel(diskModel, content)
);

watch(
  () => props.localContent,
  (content) => updateModel(mergedModel, content)
);

watch(
  () => props.language,
  (language) => {
    if (diskModel) monaco.editor.setModelLanguage(diskModel, language);
    if (mergedModel) monaco.editor.setModelLanguage(mergedModel, language);
    diffEditor?.updateOptions({ wordWrap: language === 'markdown' ? 'on' : 'off' });
  }
);

watch(
  () => props.theme,
  () => monaco.editor.setTheme(editorTheme())
);

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  diffEditor?.dispose();
  diskModel?.dispose();
  mergedModel?.dispose();
});
</script>

<template>
  <section class="diff-merge" aria-label="外部文件差异与合并">
    <header class="diff-header">
      <div class="diff-title">
        <strong>{{ filename }}</strong>
        <span>左侧为磁盘版本，右侧为可编辑的当前版本/合并结果</span>
      </div>
      <div class="diff-actions">
        <button type="button" @click="emit('back')">返回提示</button>
        <button type="button" @click="emit('use-local')">使用当前版本</button>
        <button type="button" @click="emit('use-disk')">使用磁盘版本</button>
        <button type="button" class="primary" @click="applyMerged">应用合并结果</button>
      </div>
    </header>

    <div class="diff-labels" aria-hidden="true">
      <span>磁盘版本（只读）</span>
      <span>当前版本 / 合并结果（可编辑）</span>
    </div>
    <div ref="host" class="diff-editor-host" />
  </section>
</template>

<style scoped lang="scss">
.diff-merge {
  width: min(1480px, calc(100vw - 36px));
  height: min(900px, calc(100vh - 36px));
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: auto 28px minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  background: var(--panel-bg);
  box-shadow: 0 20px 70px rgba(0, 0, 0, 0.34);
}

.diff-header {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-color);
}

.diff-title {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;

  strong {
    overflow: hidden;
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span { color: var(--text-muted); font-size: 10.5px; }
}

.diff-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 7px;

  button {
    min-height: 29px;
    padding: 0 11px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    background: var(--panel-bg);
    font-size: 11px;
    cursor: default;

    &:hover { border-color: var(--accent); background: var(--control-hover); }
    &.primary { color: #fff; border-color: var(--accent); background: var(--accent); }
  }
}

.diff-labels {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-secondary);
  background: var(--panel-muted);
  font-size: 10.5px;

  span {
    display: flex;
    align-items: center;
    padding: 0 12px;
    &:first-child { border-right: 1px solid var(--border-color); }
  }
}

.diff-editor-host {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--editor-bg);
}

@media (max-width: 820px) {
  .diff-header { align-items: flex-start; flex-direction: column; }
  .diff-actions { width: 100%; flex-wrap: wrap; }
}
</style>
