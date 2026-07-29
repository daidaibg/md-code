<script setup lang="ts" generic="T extends string">
import { computed } from 'vue';
import ToolbarDropdown from '@/components/dropdown/ToolbarDropdown.vue';

const props = defineProps<{
  title: string;
  prefix: string;
  modelValue: T;
  options: Array<{ id: T; label: string }>;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: T] }>();
const currentLabel = computed(
  () => props.options.find((item) => item.id === props.modelValue)?.label ?? props.modelValue
);
</script>

<template>
  <ToolbarDropdown
    :label="title"
    :title="title"
    :active="false"
    panel-class="theme-select-panel"
    open-on-hover
  >
    <template #trigger>
      <span class="theme-select-trigger">{{ prefix }}：{{ currentLabel }}</span>
    </template>
    <button
      v-for="option in options"
      :key="option.id"
      type="button"
      class="theme-option"
      :class="{ active: option.id === modelValue }"
      role="menuitemradio"
      :aria-checked="option.id === modelValue"
      @click="emit('update:modelValue', option.id)"
    >
      <span>{{ option.label }}</span>
      <span v-if="option.id === modelValue" aria-hidden="true">✓</span>
    </button>
  </ToolbarDropdown>
</template>

<style scoped lang="scss">
.theme-select-trigger {
  display: block;
  padding: 0 8px;
  font-size: 11px;
  line-height: 30px;
  white-space: nowrap;
}

:deep(.dropdown-trigger) {
  width: auto;
  min-width: 92px;
  padding: 0 2px;
}

:deep(.theme-select-panel) {
  width: 154px;
  padding: 4px 0;
}

.theme-option {
  width: calc(100% - 8px);
  min-height: 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 4px;
  padding: 0 10px;
  border: 0;
  border-radius: 3px;
  color: var(--text-primary);
  background: transparent;
  font-size: 12px;
  text-align: left;
  cursor: default;

  &:hover,
  &:focus-visible,
  &.active {
    color: var(--menu-selection-text);
    background: var(--menu-selection-bg);
    outline: none;
  }
}
</style>