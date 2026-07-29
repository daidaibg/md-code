<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

const props = withDefaults(
  defineProps<{
    label: string;
    title: string;
    active?: boolean;
    panelClass?: string;
    align?: 'left' | 'center' | 'right';
    openOnHover?: boolean;
  }>(),
  { active: false, panelClass: '', align: 'center', openOnHover: false }
);

const root = ref<HTMLElement>();
const open = ref(false);
let closeTimer = 0;

function cancelClose(): void {
  window.clearTimeout(closeTimer);
}

function show(): void {
  cancelClose();
  open.value = true;
}

function toggle(): void {
  cancelClose();
  open.value = !open.value;
}

function onTriggerClick(): void {
  if (props.openOnHover) {
    show();
    return;
  }

  toggle();
}

function close(): void {
  cancelClose();
  open.value = false;
}

function scheduleClose(): void {
  if (!props.openOnHover) return;
  cancelClose();
  closeTimer = window.setTimeout(close, 150);
}

function onDocumentPointerDown(event: PointerEvent): void {
  if (!root.value?.contains(event.target as Node)) close();
}

function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') close();
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown);
  document.addEventListener('keydown', onDocumentKeydown);
});

onBeforeUnmount(() => {
  cancelClose();
  document.removeEventListener('pointerdown', onDocumentPointerDown);
  document.removeEventListener('keydown', onDocumentKeydown);
});

defineExpose({ close, show });
</script>

<template>
  <div
    ref="root"
    class="dropdown"
    :class="{ open }"
    @mouseenter="openOnHover && show()"
    @mouseleave="scheduleClose"
  >
    <button
      type="button"
      class="dropdown-trigger"
      :class="{ active }"
      :title="title"
      :aria-label="label"
      :aria-expanded="open"
      aria-haspopup="menu"
      @focus="openOnHover && show()"
      @click="onTriggerClick"
    >
      <slot name="trigger" />
    </button>
    <div
      v-if="open"
      class="dropdown-panel"
      :class="[panelClass, `align-${align}`]"
      role="menu"
      @mouseenter="cancelClose"
      @mouseleave="scheduleClose"
      @click="close"
    >
      <slot />
    </div>
  </div>
</template>

<style scoped lang="scss">
.dropdown {
  position: relative;
  display: inline-flex;
}

.dropdown-trigger {
  min-width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 4px;
  color: var(--text-secondary);
  background: transparent;
  cursor: default;

  &:hover,
  &:focus-visible,
  &.active,
  .open & {
    color: var(--text-primary);
    background: var(--control-hover);
    outline: none;
  }
}

.dropdown-panel {
  position: absolute;
  z-index: 80;
  top: calc(100% + 5px);
  left: 0;
  min-width: 132px;
  padding: 5px;
  border: 1px solid var(--border-color);
  border-radius: 5px;
  color: var(--text-primary);
  background: var(--panel-bg);
  box-shadow: var(--popup-shadow);

  &::before {
    content: '';
    position: absolute;
    top: -5px;
    left: 18px;
    width: 9px;
    height: 9px;
    border-top: 1px solid var(--border-color);
    border-left: 1px solid var(--border-color);
    background: var(--panel-bg);
    transform: rotate(45deg);
  }

  &.align-center {
    left: 50%;
    transform: translateX(-50%);

    &::before {
      left: 50%;
      transform: translateX(-50%) rotate(45deg);
    }
  }

  &.align-right {
    right: 0;
    left: auto;

    &::before {
      right: 18px;
      left: auto;
    }
  }
}
</style>