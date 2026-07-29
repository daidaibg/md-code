<script setup lang="ts">
import ThemeSelectDropdown from './ThemeSelectDropdown.vue';
import { listPreviewThemes } from '@/themes/themeRegistry';
import type { PreviewThemeName } from '@/types/editor';

defineProps<{ modelValue: PreviewThemeName }>();
const emit = defineEmits<{ 'update:modelValue': [value: PreviewThemeName] }>();
const options = listPreviewThemes();
</script>

<template>
  <ThemeSelectDropdown
    title="选择 Markdown 预览主题"
    prefix="预览主题"
    :model-value="modelValue"
    :options="options"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>