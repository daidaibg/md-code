<script setup lang="ts">
import ToolbarDropdown from '@/components/dropdown/ToolbarDropdown.vue';
import ToolbarIcon from '@/components/icons/ToolbarIcon.vue';

const emit = defineEmits<{ select: [mode: 'inline' | 'block'] }>();
</script>

<template>
  <ToolbarDropdown open-on-hover label="公式" title="插入数学公式">
    <template #trigger><ToolbarIcon name="formula" /></template>
    <button type="button" class="menu-button" role="menuitem" @click="emit('select', 'inline')">
      行内公式
    </button>
    <button type="button" class="menu-button" role="menuitem" @click="emit('select', 'block')">
      块级公式
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
