<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import DocumentDiffMerge from '@/document/components/DocumentDiffMerge.vue';
import type {
  ExternalFileConflict,
  ResolvedTheme,
  SupportedLanguage
} from '@/types/editor';

const props = defineProps<{
  conflict: ExternalFileConflict | null;
  diffOpen: boolean;
  language: SupportedLanguage;
  theme: ResolvedTheme;
}>();
const initialFocus = ref<HTMLButtonElement>();

const emit = defineEmits<{
  reload: [];
  keep: [];
  diff: [];
  'close-diff': [];
  'apply-merged': [content: string];
}>();

watch(
  [() => props.conflict?.documentId, () => props.diffOpen],
  ([documentId, diffOpen]) => {
    if (!documentId || diffOpen) return;
    void nextTick(() => initialFocus.value?.focus());
  },
  { immediate: true }
);
</script>

<template>
  <div v-if="conflict" class="external-change-backdrop" role="presentation">
    <DocumentDiffMerge
      v-if="diffOpen && conflict.diskAvailable"
      :key="conflict.documentId"
      :filename="conflict.filename"
      :local-content="conflict.localContent"
      :disk-content="conflict.diskContent"
      :language="language"
      :theme="theme"
      @back="emit('close-diff')"
      @use-disk="emit('reload')"
      @use-local="emit('keep')"
      @apply-merged="emit('apply-merged', $event)"
    />

    <section
      v-else
      class="external-change-dialog"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="external-change-title"
    >
      <div class="conflict-mark" aria-hidden="true">!</div>
      <div class="conflict-copy">
        <h2 id="external-change-title">文件已在磁盘上发生变化</h2>
        <p>
          <strong>{{ conflict.filename }}</strong>
          在其他程序中{{ conflict.diskAvailable ? '被修改' : '被移动或删除' }}。{{
            conflict.localModified
              ? '当前标签页还有未保存修改，因此没有自动覆盖。'
              : '当前内容没有被清空，请选择如何处理。'
          }}
        </p>
        <code>{{ conflict.path }}</code>
      </div>
      <div class="conflict-actions">
        <button ref="initialFocus" type="button" @click="emit('keep')">保留当前版本</button>
        <button
          type="button"
          :disabled="!conflict.diskAvailable"
          @click="emit('diff')"
        >
          查看差异
        </button>
        <button
          type="button"
          class="primary"
          :disabled="!conflict.diskAvailable"
          @click="emit('reload')"
        >
          重新加载磁盘版本
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.external-change-backdrop {
  position: fixed;
  z-index: 240;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgba(13, 18, 25, 0.52);
  backdrop-filter: blur(2px);
}

.external-change-dialog {
  width: min(560px, calc(100vw - 34px));
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 13px 14px;
  padding: 20px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  background: var(--panel-bg);
  box-shadow: 0 20px 65px rgba(0, 0, 0, 0.34);
}

.conflict-mark {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: #fff;
  background: #d88716;
  font-size: 18px;
  font-weight: 700;
}

.conflict-copy {
  min-width: 0;

  h2 { margin: 2px 0 8px; font-size: 15px; }
  p { margin: 0; color: var(--text-secondary); font-size: 12px; line-height: 1.6; }
  code {
    display: block;
    margin-top: 10px;
    overflow-wrap: anywhere;
    color: var(--text-muted);
    font: 10.5px/1.5 var(--font-mono);
  }
}

.conflict-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 5px;

  button {
    min-height: 31px;
    padding: 0 12px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    background: var(--panel-bg);
    font-size: 11px;
    cursor: default;

    &:hover:not(:disabled) { border-color: var(--accent); background: var(--control-hover); }
    &:disabled { opacity: 0.45; }
    &.primary:not(:disabled) { color: #fff; border-color: var(--accent); background: var(--accent); }
  }
}
</style>
