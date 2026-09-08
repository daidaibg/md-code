<script setup lang="ts">
import { ref } from 'vue';
import FloatingDropdown from './FloatingDropdown.vue';

defineProps<{
  label: string;
  title: string;
  active?: boolean;
  panelClass?: string;
  align?: 'left' | 'center' | 'right';
  openOnHover?: boolean;
}>();
const dropdown = ref<InstanceType<typeof FloatingDropdown>>();
defineExpose({ close: () => dropdown.value?.close(), show: () => dropdown.value?.show() });
</script>

<template>
  <FloatingDropdown ref="dropdown" :label="label" :title="title" :active="active" :panel-class="panelClass" :align="align" :open-on-hover="openOnHover">
    <template #trigger><slot name="trigger" /></template>
    <slot />
  </FloatingDropdown>
</template>
