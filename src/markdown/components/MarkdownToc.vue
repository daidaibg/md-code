<script setup lang="ts">
import type { TocItem } from '@/types/editor';

defineProps<{ items: TocItem[]; activeId: string | null }>();
const emit = defineEmits<{ navigate: [id: string] }>();
</script>

<template>
  <aside class="markdown-toc" aria-label="Markdown 目录">
    <div class="toc-header">目录</div>
    <nav v-if="items.length" class="toc-list">
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        class="toc-link"
        :class="{ active: item.id === activeId }"
        :style="{ '--toc-depth': Math.max(0, item.level - 1) }"
        :title="item.text"
        @click="emit('navigate', item.id)"
      >
        {{ item.text }}
      </button>
    </nav>
    <p v-else class="toc-empty">文档中暂无标题</p>
  </aside>
</template>

<style scoped lang="scss">
.markdown-toc {
  height: 100%;
  min-width: 0;
  overflow: auto;
  border-left: 1px solid var(--border-color);
  background: var(--panel-muted);
}

.toc-header {
  position: sticky;
  z-index: 2;
  top: 0;
  height: 42px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-primary);
  background: var(--panel-muted);
  font-size: 13px;
  font-weight: 700;
}

.toc-list {
  display: grid;
  gap: 2px;
  padding: 10px 8px 30px;
}

.toc-link {
  width: 100%;
  padding: 7px 10px 7px calc(10px + var(--toc-depth) * 12px);
  overflow: hidden;
  border: 0;
  border-radius: 5px;
  color: var(--text-secondary);
  background: transparent;
  font-size: 12px;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    color: var(--text-primary);
    background: var(--control-hover);
    outline: none;
  }

  &.active {
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 11%, transparent);
    font-weight: 650;
  }
}

.toc-empty {
  margin: 20px 16px;
  color: var(--text-muted);
  font-size: 12px;
}
</style>
