<script setup lang="ts">
import ToolbarDropdown from '@/components/dropdown/ToolbarDropdown.vue';
import ToolbarIcon from '@/components/icons/ToolbarIcon.vue';

const emit = defineEmits<{ select: [level: 1 | 2 | 3 | 4 | 5 | 6] }>();
const levels = [1, 2, 3, 4, 5, 6] as const;
</script>

<template>
  <ToolbarDropdown open-on-hover label="标题" title="插入标题">
    <template #trigger><ToolbarIcon name="heading" /></template>
    <button
      v-for="level in levels"
      :key="level"
      type="button"
      class="menu-button"
      role="menuitem"
      @click="emit('select', level)"
    >
      {{ ['一', '二', '三', '四', '五', '六'][level - 1] }}级标题
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
