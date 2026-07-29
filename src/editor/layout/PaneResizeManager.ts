export type PaneResizeEdge = 'start' | 'end';

export interface PaneResizeBounds {
  min: number;
  max: number;
}

export interface PaneResizeManagerOptions {
  edge: PaneResizeEdge;
  getContainer: () => HTMLElement | undefined;
  getCurrentSize: () => number;
  getBounds: () => PaneResizeBounds;
  onResize: (size: number) => void;
  onActiveChange?: (active: boolean) => void;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

/**
 * 横向分栏拖拽适配器。
 *
 * 使用 Pointer Capture 保证指针离开分隔条后仍能连续拖动，并通过
 * requestAnimationFrame 合并高频 pointermove，避免 Monaco 重排卡顿。
 */
export class PaneResizeManager {
  private readonly options: PaneResizeManagerOptions;
  private handle: HTMLElement | null = null;
  private pointerId: number | null = null;
  private pendingClientX: number | null = null;
  private frame = 0;

  constructor(options: PaneResizeManagerOptions) {
    this.options = options;
  }

  start(event: PointerEvent): void {
    if (event.button !== 0 || this.pointerId !== null) return;
    const handle = event.currentTarget;
    if (!(handle instanceof HTMLElement)) return;

    event.preventDefault();
    this.handle = handle;
    this.pointerId = event.pointerId;
    handle.setPointerCapture(event.pointerId);
    handle.addEventListener('lostpointercapture', this.onPointerEnd);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerEnd);
    window.addEventListener('pointercancel', this.onPointerEnd);
    this.options.onActiveChange?.(true);
    this.queueResize(event.clientX);
  }

  resizeBy(delta: number): void {
    const { min, max } = this.normalizedBounds();
    this.options.onResize(Math.round(clamp(this.options.getCurrentSize() + delta, min, max)));
  }

  constrain(): void {
    this.resizeBy(0);
  }

  destroy(): void {
    this.finish();
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.pendingClientX = null;
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    event.preventDefault();
    this.queueResize(event.clientX);
  };

  private readonly onPointerEnd = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    this.flushResize();
    this.finish();
  };

  private queueResize(clientX: number): void {
    this.pendingClientX = clientX;
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.flushResize();
    });
  }

  private flushResize(): void {
    const clientX = this.pendingClientX;
    const container = this.options.getContainer();
    if (clientX === null || !container) return;
    this.pendingClientX = null;

    const bounds = container.getBoundingClientRect();
    const rawSize =
      this.options.edge === 'start' ? clientX - bounds.left : bounds.right - clientX;
    const { min, max } = this.normalizedBounds();
    this.options.onResize(Math.round(clamp(rawSize, min, max)));
  }

  private normalizedBounds(): PaneResizeBounds {
    const bounds = this.options.getBounds();
    const min = Math.max(0, bounds.min);
    return { min, max: Math.max(min, bounds.max) };
  }

  private finish(): void {
    const handle = this.handle;
    const pointerId = this.pointerId;
    if (handle) {
      handle.removeEventListener('lostpointercapture', this.onPointerEnd);
      if (pointerId !== null && handle.hasPointerCapture(pointerId)) {
        handle.releasePointerCapture(pointerId);
      }
    }
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerEnd);
    window.removeEventListener('pointercancel', this.onPointerEnd);
    this.handle = null;
    this.pointerId = null;
    this.options.onActiveChange?.(false);
  }
}
