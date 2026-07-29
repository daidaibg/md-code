<script setup lang="ts">
import ToolbarDropdown from '@/components/dropdown/ToolbarDropdown.vue';
import ToolbarIcon from '@/components/icons/ToolbarIcon.vue';

const emit = defineEmits<{ select: [action: 'link' | 'upload' | 'crop'] }>();

const options = [
  { action: 'link', label: '添加链接' },
  { action: 'upload', label: '上传图片' },
  { action: 'crop', label: '裁剪上传' }
] as const;
</script>

<template>
  <ToolbarDropdown open-on-hover label="图片" title="插入图片">
    <template #trigger><ToolbarIcon name="image" /></template>
    <button
      v-for="option in options"
      :key="option.action"
      type="button"
      class="menu-button"
      role="menuitem"
      @click="emit('select', option.action)"
    >
      {{ option.label }}
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
