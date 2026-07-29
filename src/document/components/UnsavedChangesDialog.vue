<script setup lang="ts">
import type { EditorDocument } from '@/types/editor';
import type { UnsavedDecision } from '@/document/useDocumentManager';

const props = defineProps<{
  document: EditorDocument | null;
  busy: boolean;
  closeAll?: boolean;
}>();

const emit = defineEmits<{ decide: [decision: UnsavedDecision] }>();
</script>

<template>
  <Teleport to="body">
    <div v-if="document" class="dialog-backdrop" role="presentation">
      <section class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="unsaved-title">
        <h2 id="unsaved-title">保存更改？</h2>
        <p>
          <strong>{{ document.filename }}</strong> 包含未保存的更改。
          <template v-if="closeAll">关闭应用前需要处理此文档。</template>
        </p>
        <div class="dialog-actions">
          <button type="button" :disabled="busy" @click="emit('decide', 'cancel')">取消</button>
          <button type="button" class="danger" :disabled="busy" @click="emit('decide', 'discard')">不保存</button>
          <button type="button" class="primary" :disabled="busy" @click="emit('decide', 'save')">保存</button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.dialog-backdrop {
  position: fixed;
  z-index: 200;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(12, 18, 28, 0.44);
}

.dialog {
  width: min(440px, 100%);
  padding: 22px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  background: var(--panel-bg);
  box-shadow: var(--popup-shadow);

  h2 { margin: 0 0 12px; font-size: 18px; }
  p { margin: 0; color: var(--text-secondary); line-height: 1.65; }
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 22px;

  button {
    min-width: 76px;
    height: 32px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    background: var(--panel-muted);
    cursor: pointer;
  }

  .primary { color: #fff; border-color: var(--accent); background: var(--accent); }
  .danger { color: var(--danger); }
  button:disabled { opacity: 0.55; cursor: not-allowed; }
}
</style>