<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { EditorDocument, ResolvedTheme } from '@/types/editor';

const props = defineProps<{
  document: EditorDocument | null;
  busy: boolean;
  theme: ResolvedTheme;
  error?: string | null;
}>();

const emit = defineEmits<{
  cancel: [];
  rename: [filename: string];
}>();

const input = ref<HTMLInputElement>();
const filename = ref('');
const validationMessage = computed(() => {
  const value = filename.value.trim();
  if (!value) return '文件名不能为空';
  if (/[<>:"/\\|?*\u0000-\u001f]/u.test(value)) return '文件名不能包含 < > : " / \\ | ? *';
  if (value === '.' || value === '..' || /[. ]$/u.test(value)) return '文件名不能以句点或空格结尾';
  return '';
});

watch(
  () => props.document,
  (document) => {
    if (!document) return;
    filename.value = document.filename;
    void nextTick(() => {
      const element = input.value;
      if (!element) return;
      element.focus();
      const extensionIndex = document.filename.lastIndexOf('.');
      element.setSelectionRange(0, extensionIndex > 0 ? extensionIndex : document.filename.length);
    });
  },
  { immediate: true }
);

function submit(): void {
  if (props.busy || validationMessage.value) return;
  emit('rename', filename.value.trim());
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="document"
      class="rename-backdrop"
      :data-theme="theme"
      role="presentation"
      @keydown.esc.prevent="emit('cancel')"
    >
      <form
        class="rename-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-title"
        @submit.prevent="submit"
      >
        <h2 id="rename-title">重命名文件</h2>
        <p>{{ document.path ? '文件将同时在磁盘上重命名。' : '设置保存时使用的文件名。' }}</p>
        <input
          ref="input"
          v-model="filename"
          type="text"
          spellcheck="false"
          autocomplete="off"
          :disabled="busy"
          :aria-invalid="Boolean(validationMessage)"
          aria-describedby="rename-validation"
        />
        <span id="rename-validation" class="validation-message">
          {{ validationMessage || error || '' }}
        </span>
        <div class="rename-actions">
          <button type="button" :disabled="busy" @click="emit('cancel')">取消</button>
          <button type="submit" class="primary" :disabled="busy || Boolean(validationMessage)">
            重命名
          </button>
        </div>
      </form>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.rename-backdrop {
  position: fixed;
  z-index: 270;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(12, 18, 28, 0.52);
  backdrop-filter: blur(2px);
}

.rename-dialog {
  width: min(430px, calc(100vw - 48px));
  padding: 21px;
  border: 1px solid var(--border-color, #d7d7d7);
  border-radius: 8px;
  color: var(--text-primary, #1f2328);
  background: var(--panel-bg, #ffffff);
  box-shadow: 0 22px 70px rgba(0, 0, 0, 0.35);
  font-family: var(--font-sans, "Segoe UI", sans-serif);

  h2 { margin: 0; font-size: 16px; font-weight: 600; }
  p { margin: 8px 0 14px; color: var(--text-secondary, #505963); font-size: 12px; }

  input {
    width: 100%;
    height: 34px;
    padding: 0 10px;
    border: 1px solid var(--border-color, #d7d7d7);
    border-radius: 4px;
    outline: none;
    color: var(--text-primary, #1f2328);
    background: var(--editor-bg, #ffffff);
    font: 12px var(--font-sans, "Segoe UI", sans-serif);

    &:focus {
      border-color: var(--accent, #1976d2);
      box-shadow: 0 0 0 1px var(--accent, #1976d2);
    }

    &[aria-invalid='true'] { border-color: var(--danger, #c73434); }
    &:disabled { opacity: 0.58; }
  }
}

.validation-message {
  min-height: 18px;
  display: block;
  padding-top: 4px;
  color: var(--danger, #c73434);
  font-size: 10.5px;
}

.rename-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;

  button {
    min-width: 78px;
    height: 31px;
    padding: 0 14px;
    border: 1px solid var(--border-color, #d7d7d7);
    border-radius: 4px;
    color: var(--text-primary, #1f2328);
    background: var(--panel-muted, #f5f5f5);
    font-size: 11px;
    cursor: default;

    &:hover:not(:disabled) { border-color: var(--accent, #1976d2); }
    &:disabled { opacity: 0.5; }
    &.primary { color: #ffffff; border-color: var(--accent, #1976d2); background: var(--accent, #1976d2); }
  }
}
</style>
