<script setup lang="ts">
import ThemeSelectDropdown from './ThemeSelectDropdown.vue';
import { listCodeThemes } from '@/themes/themeRegistry';
import type { CodeThemeName } from '@/types/editor';

defineProps<{ modelValue: CodeThemeName }>();
const emit = defineEmits<{ 'update:modelValue': [value: CodeThemeName] }>();
const options = listCodeThemes();
</script>

<template>
  <ThemeSelectDropdown
    title="选择代码块风格"
    prefix="代码风格"
    :model-value="modelValue"
    :options="options"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>