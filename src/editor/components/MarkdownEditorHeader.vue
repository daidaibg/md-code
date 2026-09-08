<script setup lang="ts">
defineProps<{ title?: string }>();
</script>

<template>
  <header class="markdown-editor-header">
    <strong v-if="title" class="header-title">{{ title }}</strong>
    <span v-else class="header-spacer" aria-hidden="true" />
    <div class="header-controls"><slot /></div>
    <div v-if="$slots.actions" class="header-actions"><slot name="actions" /></div>
  </header>
</template>

<style scoped>
.markdown-editor-header { position: relative; z-index: 20; display: flex; align-items: center; flex-shrink: 0; box-sizing: border-box; height: 32px; min-height: 32px; max-height: 32px; gap: 10px; padding: 0 12px; border-bottom: 1px solid var(--border-color); background: var(--chrome-bg); color: var(--text-primary); overflow: visible; }
.header-title { margin-right: 12px; flex: 0 0 auto; font-size: 14px; }
.header-spacer { display: none; }
.header-controls { min-width: 0; flex: 1 1 auto; overflow-x: auto; scrollbar-width: none; }
.header-controls::-webkit-scrollbar { display: none; }
.header-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.header-controls :deep(.editor-view-controls) { width: 100%; justify-content: flex-start; flex-wrap: nowrap; }
</style>
