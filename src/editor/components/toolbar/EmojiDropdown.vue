<script setup lang="ts">
import ToolbarDropdown from '@/components/dropdown/ToolbarDropdown.vue';
import ToolbarIcon from '@/components/icons/ToolbarIcon.vue';

const emit = defineEmits<{ select: [value: string] }>();
const emojis = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😲', '🤔', '😊',
  '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
  '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳',
  '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '👻', '😣', '😖',
  '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳'
];
</script>

<template>
  <ToolbarDropdown open-on-hover label="Emoji" title="插入 Emoji" panel-class="emoji-panel">
    <template #trigger><ToolbarIcon name="emoji" /></template>
    <div class="emoji-grid" role="grid" aria-label="选择 Emoji">
      <button
        v-for="emoji in emojis"
        :key="emoji"
        type="button"
        class="emoji-button"
        :aria-label="`插入 ${emoji}`"
        @click="emit('select', emoji)"
      >
        {{ emoji }}
      </button>
    </div>
  </ToolbarDropdown>
</template>

<style scoped lang="scss">
.emoji-grid {
  display: grid;
  grid-template-columns: repeat(11, 42px);
  border-top: 1px solid var(--border-subtle);
  border-left: 1px solid var(--border-subtle);
}

.emoji-button {
  width: 42px;
  height: 42px;
  padding: 0;
  border: 0;
  border-right: 1px solid var(--border-subtle);
  border-bottom: 1px solid var(--border-subtle);
  background: transparent;
  font-size: 23px;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    background: var(--control-hover);
    outline: none;
  }
}

:deep(.emoji-panel) {
  width: max-content;
  padding: 16px;
}
</style>
