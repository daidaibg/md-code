<script setup lang="ts">
import ToolbarDropdown from '@/components/dropdown/ToolbarDropdown.vue';
import ToolbarIcon from '@/components/icons/ToolbarIcon.vue';
import type { AdmonitionKind } from '@/types/editor';

const emit = defineEmits<{ select: [kind: AdmonitionKind] }>();
const kinds: Array<{ kind: AdmonitionKind; label: string }> = [
  { kind: 'note', label: '提示' },
  { kind: 'info', label: '信息' },
  { kind: 'tip', label: '技巧' },
  { kind: 'warning', label: '警告' },
  { kind: 'danger', label: '危险' }
];
</script>

<template>
  <ToolbarDropdown open-on-hover label="提示块" title="插入提示块">
    <template #trigger><ToolbarIcon name="admonition" /></template>
    <button
      v-for="item in kinds"
      :key="item.kind"
      type="button"
      class="menu-button"
      role="menuitem"
      @click="emit('select', item.kind)"
    >
      <span class="kind-dot" :class="`kind-${item.kind}`" aria-hidden="true" />
      {{ item.label }}
      <code>{{ item.kind }}</code>
    </button>
  </ToolbarDropdown>
</template>

<style scoped lang="scss">
.menu-button {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 10px;
  border: 0;
  border-radius: 4px;
  color: inherit;
  background: transparent;
  text-align: left;
  font-size: 11px;
  white-space: nowrap;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    background: var(--control-hover);
    outline: none;
  }
}

.kind-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #64748b;
}
.menu-button code { margin-left: auto; padding-left: 8px; font-size: 11px; opacity: .8; }

.kind-info { background: #0284c7; }
.kind-tip { background: #059669; }
.kind-warning { background: #d97706; }
.kind-danger { background: #dc2626; }
</style>
