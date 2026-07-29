<script setup lang="ts">
import { computed } from 'vue';
import { languageLabel } from '@/editor/language/languageManager';
import type { EditorDocument } from '@/types/editor';

const props = defineProps<{
  document: EditorDocument | undefined;
  documentCount: number;
  recoveryEnabled: boolean;
}>();

const modeLabel = computed(() => {
  if (props.document?.mode === 'split') return '分栏';
  if (props.document?.mode === 'editor') return '仅编辑';
  return '仅预览';
});
</script>

<template>
  <footer class="status-bar">
    <span class="status-path">{{ document?.path ?? '尚未保存到磁盘' }}</span>
    <div class="status-details">
      <span v-if="document">行 {{ document.cursor.lineNumber }}，列 {{ document.cursor.column }}</span>
      <span v-if="document">{{ languageLabel(document.language) }}</span>
      <span>{{ modeLabel }}</span>
      <span>{{ document?.modified ? '未保存' : '已保存' }}</span>
      <span>{{ documentCount }} 个文档</span>
      <span>{{ recoveryEnabled ? '自动恢复已开启' : '自动恢复不可用' }}</span>
    </div>
  </footer>
</template>

<style scoped lang="scss">
.status-bar {
  min-width: 0;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 8px;
  border-top: 1px solid var(--border-color);
  color: var(--status-text);
  background: var(--status-bg);
  font-size: 10px;
  user-select: none;
}

.status-path {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-details {
  display: flex;
  gap: 13px;
  flex: 0 0 auto;
}

@media (max-width: 800px) {
  .status-details span:nth-child(n + 4) { display: none; }
}
</style>