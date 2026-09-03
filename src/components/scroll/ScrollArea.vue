<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue';
import { clampScroll, scrollFromThumb, scrollGeometry } from './scrollGeometry';

const props = withDefaults(defineProps<{ label: string; fillContent?: boolean }>(), { fillContent: false });
const emit = defineEmits<{
  scroll: [event: Event];
  'viewport-change': [element: HTMLElement | undefined];
}>();
const viewport = ref<HTMLElement>();
const content = ref<HTMLElement>();
const viewportId = useId();
const metrics = ref({ width: 0, height: 0, scrollWidth: 0, scrollHeight: 0, left: 0, top: 0 });
const hovered = ref(false);
const scrolling = ref(false);
const dragging = ref(false);
const thickness = 14;
const hasX = computed(() => metrics.value.scrollWidth > metrics.value.width + 1);
const hasY = computed(() => metrics.value.scrollHeight > metrics.value.height + 1);
const axes = computed(() => ({
  x: scrollGeometry(metrics.value.width, metrics.value.scrollWidth, metrics.value.left, metrics.value.width - (hasY.value ? thickness : 0)),
  y: scrollGeometry(metrics.value.height, metrics.value.scrollHeight, metrics.value.top, metrics.value.height - (hasX.value ? thickness : 0))
}));
type Axis = 'x' | 'y';
let frame = 0;
let hideTimer: ReturnType<typeof setTimeout> | undefined;
let resizeObserver: ResizeObserver | undefined;
let mutationObserver: MutationObserver | undefined;
let drag: { axis: Axis; pointerId: number; element: HTMLElement; grab: number } | undefined;

function measure(): void {
  frame = 0;
  const el = viewport.value;
  if (!el) return;
  metrics.value = { width: el.clientWidth, height: el.clientHeight, scrollWidth: el.scrollWidth, scrollHeight: el.scrollHeight, left: el.scrollLeft, top: el.scrollTop };
}

function refresh(): void {
  if (!frame) frame = requestAnimationFrame(measure);
}

function onScroll(event: Event): void {
  refresh();
  scrolling.value = true;
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => { scrolling.value = false; }, 800);
  // Keep the real viewport and its native scroll events as the source of truth.
  emit('scroll', event);
}

function setPosition(axis: Axis, value: number): void {
  const el = viewport.value;
  if (!el) return;
  const target = clampScroll(value, axes.value[axis].maxScroll);
  if (axis === 'y') el.scrollTop = target;
  else el.scrollLeft = target;
  refresh();
}

function coordinate(event: PointerEvent, axis: Axis, element: HTMLElement): number {
  const rect = element.getBoundingClientRect();
  return axis === 'y' ? event.clientY - rect.top : event.clientX - rect.left;
}

function startDrag(event: PointerEvent, axis: Axis): void {
  if (event.button !== 0) return;
  event.preventDefault();
  measure();
  const element = event.currentTarget as HTMLElement;
  const geometry = axes.value[axis];
  const point = coordinate(event, axis, element);
  const onThumb = (event.target as HTMLElement).classList.contains('scroll-area__thumb');
  const grab = onThumb ? point - geometry.offset : geometry.size / 2;
  drag = { axis, pointerId: event.pointerId, element, grab };
  dragging.value = true;
  element.setPointerCapture(event.pointerId);
  if (!onThumb) setPosition(axis, scrollFromThumb(point - grab, geometry));
}

function moveDrag(event: PointerEvent): void {
  if (!drag || drag.pointerId !== event.pointerId) return;
  const { axis, element, grab } = drag;
  setPosition(axis, scrollFromThumb(coordinate(event, axis, element) - grab, axes.value[axis]));
}

function endDrag(): void {
  const previous = drag;
  drag = undefined;
  dragging.value = false;
  if (previous?.element.hasPointerCapture(previous.pointerId)) previous.element.releasePointerCapture(previous.pointerId);
}

function onKey(event: KeyboardEvent, axis: Axis): void {
  const el = viewport.value;
  if (!el) return;
  measure();
  const position = axis === 'y' ? el.scrollTop : el.scrollLeft;
  const page = (axis === 'y' ? el.clientHeight : el.clientWidth) * 0.9;
  let target: number;
  if (event.key === 'Home') target = 0;
  else if (event.key === 'End') target = axes.value[axis].maxScroll;
  else if (event.key === 'PageUp') target = position - page;
  else if (event.key === 'PageDown') target = position + page;
  else if (event.key === (axis === 'y' ? 'ArrowUp' : 'ArrowLeft')) target = position - 40;
  else if (event.key === (axis === 'y' ? 'ArrowDown' : 'ArrowRight')) target = position + 40;
  else return;
  event.preventDefault();
  event.stopPropagation();
  setPosition(axis, target);
}

function onTrackWheel(event: WheelEvent): void {
  const el = viewport.value;
  if (!el) return;
  const unit = event.deltaMode === 1 ? 20 : event.deltaMode === 2 ? el.clientHeight : 1;
  el.scrollBy({ left: (event.deltaX || (event.shiftKey ? event.deltaY : 0)) * unit, top: (event.shiftKey ? 0 : event.deltaY) * unit });
}

onMounted(() => {
  measure();
  resizeObserver = new ResizeObserver(refresh);
  if (viewport.value) resizeObserver.observe(viewport.value);
  if (content.value) {
    resizeObserver.observe(content.value);
    mutationObserver = new MutationObserver(refresh);
    mutationObserver.observe(content.value, { childList: true, subtree: true, characterData: true, attributes: true });
    content.value.addEventListener('load', refresh, true);
  }
  emit('viewport-change', viewport.value);
});

onBeforeUnmount(() => {
  endDrag();
  resizeObserver?.disconnect();
  mutationObserver?.disconnect();
  content.value?.removeEventListener('load', refresh, true);
  if (frame) cancelAnimationFrame(frame);
  clearTimeout(hideTimer);
  emit('viewport-change', undefined);
});

defineExpose({ viewport, refresh, scrollTo: (options: ScrollToOptions) => viewport.value?.scrollTo(options) });
</script>

<template>
  <div class="scroll-area" :class="{ 'is-visible': hovered || scrolling || dragging, 'is-dragging': dragging }" @pointerenter="hovered = true" @pointerleave="hovered = false">
    <div :id="viewportId" ref="viewport" class="scroll-area__viewport" tabindex="0" role="region" :aria-label="props.label" @scroll.passive="onScroll">
      <div ref="content" class="scroll-area__content" :class="{ 'is-fill': fillContent }"><slot /></div>
    </div>
    <template v-for="axis in (['x', 'y'] as const)" :key="axis">
      <div v-if="axis === 'x' ? hasX : hasY" class="scroll-area__track" :class="`is-${axis}`"
        :style="axis === 'y' ? { bottom: hasX ? `${thickness}px` : '0' } : { right: hasY ? `${thickness}px` : '0' }"
        role="scrollbar" tabindex="0" :aria-label="`${label}${axis === 'y' ? '纵向' : '横向'}滚动条`" :aria-controls="viewportId"
        :aria-orientation="axis === 'y' ? 'vertical' : 'horizontal'" :aria-valuemin="0" :aria-valuemax="axes[axis].maxScroll"
        :aria-valuenow="Math.round(axis === 'y' ? metrics.top : metrics.left)"
        @pointerdown="startDrag($event, axis)" @pointermove="moveDrag" @pointerup="endDrag" @pointercancel="endDrag" @lostpointercapture="endDrag"
        @keydown="onKey($event, axis)" @wheel.prevent="onTrackWheel">
        <div class="scroll-area__thumb" :style="axis === 'y' ? { height: `${axes.y.size}px`, transform: `translateY(${axes.y.offset}px)` } : { width: `${axes.x.size}px`, transform: `translateX(${axes.x.offset}px)` }" />
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.scroll-area { position: relative; min-width: 0; min-height: 0; overflow: hidden; }
.scroll-area__viewport {
  position: absolute;
  inset: 0;
  overflow: auto;
  overflow-anchor: none;
  scrollbar-width: none;
  // No gutter: the overlay sits above the content instead of exposing a strip of canvas.
  &::-webkit-scrollbar { display: none; width: 0; height: 0; }
  &:focus-visible { outline: 1px solid var(--accent); outline-offset: -1px; }
}
.scroll-area__content { display: flow-root; min-height: 100%; }
.scroll-area__content.is-fill { height: 100%; }
.scroll-area__track {
  position: absolute;
  z-index: 10;
  background: transparent;
  opacity: 0;
  pointer-events: none;
  transition: opacity 450ms ease;
  touch-action: none;
  user-select: none;
  &.is-y { top: 0; right: 0; width: 14px; }
  &.is-x { bottom: 0; left: 0; height: 14px; }
  &:focus-visible { outline: 1px solid var(--accent); outline-offset: -1px; }
}
.scroll-area__thumb {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--content-scrollbar-thumb, #79797966);
  &:hover { background: var(--content-scrollbar-hover, #646464b3); }
}
.scroll-area.is-visible > .scroll-area__track,
.scroll-area:has(> .scroll-area__viewport:focus-visible) > .scroll-area__track,
.scroll-area__track:focus-visible { opacity: 1; pointer-events: auto; transition-duration: 300ms; }
.scroll-area.is-dragging > .scroll-area__track > .scroll-area__thumb { background: var(--content-scrollbar-active, #00000099); }
// Keep the explicitly requested opacity-only fade even with reduced motion.
// This does not animate content position or change Monaco's motion preferences.
@media (forced-colors: active) { .scroll-area__thumb { background: CanvasText; forced-color-adjust: none; } }
</style>
