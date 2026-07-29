<script setup lang="ts">
import { computed, ref } from 'vue';
import ToolbarDropdown from '@/components/dropdown/ToolbarDropdown.vue';
import ToolbarIcon from '@/components/icons/ToolbarIcon.vue';

const emit = defineEmits<{ select: [rows: number, columns: number] }>();
const maxRows = 6;
const maxColumns = 8;
const hoverRows = ref(2);
const hoverColumns = ref(2);
const cells = Array.from({ length: maxRows * maxColumns }, (_, index) => ({
  row: Math.floor(index / maxColumns) + 1,
  column: (index % maxColumns) + 1
}));
const selectionLabel = computed(() => `${hoverColumns.value} × ${hoverRows.value} 表格`);

function hover(row: number, column: number): void {
  hoverRows.value = row;
  hoverColumns.value = column;
}
</script>

<template>
  <ToolbarDropdown open-on-hover label="表格" title="插入表格" panel-class="table-panel">
    <template #trigger><ToolbarIcon name="table" /></template>
    <div class="selection-label">{{ selectionLabel }}</div>
    <div class="table-grid" role="grid" aria-label="选择表格行列数">
      <button
        v-for="cell in cells"
        :key="`${cell.row}-${cell.column}`"
        type="button"
        class="grid-cell"
        :class="{ selected: cell.row <= hoverRows && cell.column <= hoverColumns }"
        :aria-label="`${cell.column} 列 ${cell.row} 行`"
        @pointerenter="hover(cell.row, cell.column)"
        @focus="hover(cell.row, cell.column)"
        @click="emit('select', cell.row, cell.column)"
      />
    </div>
  </ToolbarDropdown>
</template>

<style scoped lang="scss">
.selection-label {
  height: 25px;
  color: var(--text-secondary);
  font-size: 12px;
  text-align: center;
}

.table-grid {
  display: grid;
  grid-template-columns: repeat(8, 28px);
  gap: 6px;
}

.grid-cell {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--border-subtle);
  border-radius: 5px;
  background: color-mix(in srgb, var(--text-muted) 20%, var(--panel-bg));
  cursor: pointer;

  &.selected {
    border-color: color-mix(in srgb, var(--accent) 65%, var(--border-color));
    background: color-mix(in srgb, var(--accent) 32%, var(--panel-bg));
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
}

:deep(.table-panel) {
  width: max-content;
  padding: 10px;
}
</style>

