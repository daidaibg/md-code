<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { arrow, autoUpdate, flip, offset, shift, size, useFloating } from '@floating-ui/vue';

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
const trigger = ref<HTMLButtonElement>();
const panel = ref<HTMLElement>();
const arrowElement = ref<HTMLElement>();
const open = ref(false);
const theme = ref('light');
const { floatingStyles, isPositioned, middlewareData, placement } = useFloating(trigger, panel, {
  open,
  strategy: 'fixed',
  placement: computed(() => props.align === 'left' ? 'bottom-start' : props.align === 'right' ? 'bottom-end' : 'bottom'),
  whileElementsMounted: autoUpdate,
  middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 }), size({ padding: 8,
    apply({ availableHeight, availableWidth, elements }) {
      Object.assign(elements.floating.style, { maxHeight: `${Math.max(0, availableHeight)}px`, maxWidth: `${Math.max(0, availableWidth)}px` });
    }
  }), arrow({ element: arrowElement, padding: 10 })]
});
const arrowStyle = computed(() => {
  const side = placement.value.split('-')[0];
  const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }[side] ?? 'top';
  const data = middlewareData.value.arrow;
  return { left: data?.x == null ? undefined : `${data.x}px`, top: data?.y == null ? undefined : `${data.y}px`,
    [opposite]: '-5px', transform: `rotate(${side === 'top' ? 225 : side === 'left' ? 135 : side === 'right' ? -45 : 45}deg)` };
});
let closeTimer = 0;

function cancelClose(): void {
  window.clearTimeout(closeTimer);
}

function show(): void {
  cancelClose();
  theme.value = root.value?.closest('[data-theme]')?.getAttribute('data-theme') ?? 'light';
  open.value = true;
}

function toggle(): void {
  cancelClose();
  if (open.value) close(); else show();
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

function selectItem(): void {
  const restoreFocus = !!panel.value?.contains(document.activeElement);
  close();
  if (restoreFocus) trigger.value?.focus();
}

function scheduleClose(): void {
  if (!props.openOnHover) return;
  cancelClose();
  closeTimer = window.setTimeout(close, 150);
}

function onDocumentPointerDown(event: PointerEvent): void {
  if (!root.value?.contains(event.target as Node) && !panel.value?.contains(event.target as Node)) close();
}

function onDocumentKeydown(event: KeyboardEvent): void {
  if (!open.value) return;
  if (event.key === 'Escape') { event.preventDefault(); close(); trigger.value?.focus(); }
}

function items(): HTMLElement[] {
  return [...(panel.value?.querySelectorAll<HTMLElement>('button:not(:disabled), [role="menuitem"]:not([aria-disabled="true"])') ?? [])];
}
async function focusMenu(event: KeyboardEvent): Promise<void> {
  event.preventDefault();
  show();
  await nextTick();
  const options = items();
  (event.key === 'ArrowUp' ? options.at(-1) : options[0])?.focus();
}
function menuKeydown(event: KeyboardEvent): void {
  if (event.key === 'Tab') { close(); trigger.value?.focus(); return; }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  const options = items();
  if (!options.length) return;
  event.preventDefault();
  const current = options.indexOf(document.activeElement as HTMLElement);
  const index = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 :
    (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
  options[index]?.focus();
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown);
  document.addEventListener('keydown', onDocumentKeydown);
  window.addEventListener('blur', close);
});

onBeforeUnmount(() => {
  cancelClose();
  document.removeEventListener('pointerdown', onDocumentPointerDown);
  document.removeEventListener('keydown', onDocumentKeydown);
  window.removeEventListener('blur', close);
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
      ref="trigger"
      type="button"
      class="dropdown-trigger"
      :class="{ active }"
      :title="title"
      :aria-label="label"
      :aria-expanded="open"
      aria-haspopup="menu"
      @keydown.down="focusMenu"
      @keydown.up="focusMenu"
      @click="onTriggerClick"
    >
      <slot name="trigger" />
    </button>
    <Teleport to="body">
    <div
      ref="panel"
      v-if="open"
      class="dropdown-panel"
      :class="[panelClass, `align-${align}`]"
      :data-theme="theme"
      :style="[floatingStyles, { visibility: isPositioned ? 'visible' : 'hidden' }]"
      role="menu"
      @mouseenter="cancelClose"
      @mouseleave="scheduleClose"
      @click="selectItem"
      @keydown="menuKeydown"
    >
      <span ref="arrowElement" class="dropdown-arrow" :style="arrowStyle" aria-hidden="true" />
      <div class="dropdown-content"><slot /></div>
    </div>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
.dropdown {
  position: relative;
  display: inline-flex;
}

.dropdown-trigger {
  min-width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 4px;
  color: var(--text-secondary);
  background: transparent;
  cursor: pointer;

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
  z-index: 300;
  width: max-content;
  min-width: min(132px, calc(100vw - 16px));
  padding: 0;
  overflow: visible;
  border: 1px solid var(--border-color);
  border-radius: 5px;
  color: var(--text-primary);
  background: var(--panel-bg);
  box-shadow: var(--popup-shadow);
}
.dropdown-arrow { position: absolute; width: 9px; height: 9px; border-top: 1px solid var(--border-color); border-left: 1px solid var(--border-color); background: var(--panel-bg); pointer-events: none; }
.dropdown-content { position: relative; padding: 5px; max-height: inherit; overflow: auto; overscroll-behavior: contain; border-radius: inherit; }
.dropdown-panel.theme-select-panel { width: 154px; }
.dropdown-panel.mermaid-panel { width: 150px; }
.theme-select-panel > .dropdown-content { padding: 4px 0; }
.dropdown-panel.table-panel, .dropdown-panel.emoji-panel { width: max-content; }
.table-panel > .dropdown-content { padding: 10px; }
.emoji-panel > .dropdown-content { padding: 16px; }
</style>
