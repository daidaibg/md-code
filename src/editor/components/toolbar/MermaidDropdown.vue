<script setup lang="ts">
import ToolbarDropdown from '@/components/dropdown/ToolbarDropdown.vue';
import ToolbarIcon from '@/components/icons/ToolbarIcon.vue';
import type { MermaidDiagramType } from '@/types/editor';

const emit = defineEmits<{ select: [diagram: MermaidDiagramType] }>();
const diagrams: Array<{ type: MermaidDiagramType; label: string }> = [
  { type: 'flowchart', label: '流程图' },
  { type: 'sequence', label: '时序图' },
  { type: 'gantt', label: '甘特图' },
  { type: 'class', label: '类图' },
  { type: 'state', label: '状态图' },
  { type: 'pie', label: '饼图' },
  { type: 'er', label: '关系图' },
  { type: 'journey', label: '旅程图' }
];
</script>

<template>
  <ToolbarDropdown open-on-hover label="Mermaid" title="插入 Mermaid 图表">
    <template #trigger><ToolbarIcon name="mermaid" /></template>
    <button
      v-for="item in diagrams"
      :key="item.type"
      type="button"
      class="menu-button"
      role="menuitem"
      @click="emit('select', item.type)"
    >
      {{ item.label }}
    </button>
  </ToolbarDropdown>
</template>

<style scoped lang="scss">
.menu-button {
  width: 100%;
  padding: 7px 10px;
  border: 0;
  border-radius: 4px;
  color: inherit;
  background: transparent;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    background: var(--control-hover);
    outline: none;
  }
}
</style>
