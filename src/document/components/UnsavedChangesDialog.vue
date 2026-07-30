<script setup lang="ts">
import type { EditorDocument, ResolvedTheme } from '@/types/editor';
import type { UnsavedDecision } from '@/document/useDocumentManager';

const props = defineProps<{
  document: EditorDocument | null;
  busy: boolean;
  closeAll?: boolean;
  theme: ResolvedTheme;
}>();

const emit = defineEmits<{ decide: [decision: UnsavedDecision] }>();
</script>

<template>
  <Teleport to="body">
    <div
      v-if="document"
      class="unsaved-backdrop"
      :data-theme="theme"
      role="presentation"
    >
      <section
        class="unsaved-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-title"
        aria-describedby="unsaved-description"
      >
        <div class="dialog-content">
          <div class="warning-icon" aria-hidden="true">!</div>
          <div class="dialog-copy">
            <h2 id="unsaved-title">是否保存更改？</h2>
            <p id="unsaved-description">
              <strong>{{ document.filename }}</strong> 包含未保存的更改。
            </p>
            <p v-if="closeAll" class="dialog-hint">关闭应用前需要处理此文档。</p>
          </div>
        </div>

        <div class="unsaved-actions">
          <button type="button" :disabled="busy" @click="emit('decide', 'cancel')">取消</button>
          <button
            type="button"
            class="discard-button"
            :disabled="busy"
            @click="emit('decide', 'discard')"
          >
            不保存
          </button>
          <button
            type="button"
            class="save-button"
            :disabled="busy"
            autofocus
            @click="emit('decide', 'save')"
          >
            保存
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.unsaved-backdrop {
  position: fixed;
  z-index: 260;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(12, 18, 28, 0.52);
  backdrop-filter: blur(2px);
}

.unsaved-dialog {
  width: min(440px, calc(100vw - 48px));
  overflow: hidden;
  border: 1px solid var(--border-color, #d7d7d7);
  border-radius: 8px;
  color: var(--text-primary, #1f2328);
  background: var(--panel-bg, #ffffff);
  box-shadow: 0 22px 70px rgba(0, 0, 0, 0.35);
  font-family: var(--font-sans, "Segoe UI", sans-serif);
  font-size: 12px;
}

.dialog-content {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 14px;
  padding: 22px 22px 18px;
}

.warning-icon {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: #ffffff;
  background: #d88716;
  font-size: 19px;
  font-weight: 700;
  line-height: 1;
}

.dialog-copy {
  min-width: 0;

  h2 {
    margin: 1px 0 10px;
    color: var(--text-primary, #1f2328);
    font-size: 16px;
    font-weight: 600;
    line-height: 1.35;
  }

  p {
    margin: 0;
    color: var(--text-secondary, #505963);
    font-size: 12px;
    line-height: 1.65;
    overflow-wrap: anywhere;
  }

  strong {
    color: var(--text-primary, #1f2328);
    font-weight: 600;
  }

  .dialog-hint {
    margin-top: 3px;
    color: var(--text-muted, #7b8490);
  }
}

.unsaved-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--border-subtle, #e7e7e7);
  background: var(--panel-muted, #f5f5f5);

  button {
    min-width: 78px;
    height: 31px;
    padding: 0 14px;
    border: 1px solid var(--border-color, #d7d7d7);
    border-radius: 4px;
    color: var(--text-primary, #1f2328);
    background: var(--panel-bg, #ffffff);
    font-size: 11px;
    cursor: default;

    &:hover:not(:disabled) {
      border-color: var(--accent, #1976d2);
      background: var(--control-hover, #e8eef7);
    }

    &:focus-visible {
      outline: 1px solid var(--accent, #1976d2);
      outline-offset: 1px;
    }

    &:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
  }

  .discard-button {
    color: var(--danger, #c73434);
  }

  .save-button {
    color: #ffffff;
    border-color: var(--accent, #1976d2);
    background: var(--accent, #1976d2);

    &:hover:not(:disabled) {
      color: #ffffff;
      background: color-mix(in srgb, var(--accent, #1976d2) 88%, #000000);
    }
  }
}
</style>
