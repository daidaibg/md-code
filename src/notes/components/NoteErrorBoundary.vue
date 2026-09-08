<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue';

const failure = ref('');
const revision = ref(0);
onErrorCaptured((reason, _instance, info) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  failure.value = `${info}：${message}`;
  console.error('[便签首次异常]', reason, info);
  return false;
});
function retry(): void {
  revision.value++;
  failure.value = '';
}
</script>

<template>
  <div v-if="failure" class="note-load-error" role="alert">
    <strong>便签加载失败</strong>
    <pre>{{ failure }}</pre>
    <button type="button" @click="retry">重新加载便签</button>
  </div>
  <slot v-else :key="revision" />
</template>

<style scoped>
.note-load-error { padding: 24px; color: var(--text-primary); }
pre { white-space: pre-wrap; overflow-wrap: anywhere; user-select: text; }
button { padding: 6px 12px; cursor: pointer; }
</style>
