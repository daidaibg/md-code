import Sortable, { type MoveEvent, type SortableEvent } from 'sortablejs';

export interface TabReorderEvent {
  documentId: string;
  oldIndex: number;
  newIndex: number;
}

export interface TabDragSession {
  documentId: string;
  source: HTMLElement;
}

export interface TabDragManagerOptions {
  onReorder: (event: TabReorderEvent) => void;
  onDragStart?: (session: TabDragSession) => void;
  onDragMove?: (session: TabDragSession, event: Event) => void;
  onDragEnd?: (session: TabDragSession) => void;
}

const TAB_SELECTOR = '.document-tab';
const TAB_DRAG_GROUP = 'md-code-document-tabs';
const TAB_DROP_BEFORE_CLASS = 'tab-drop-before';
const TAB_DROP_AFTER_CLASS = 'tab-drop-after';
const TAB_DROP_CLASSES = [TAB_DROP_BEFORE_CLASS, TAB_DROP_AFTER_CLASS] as const;

function documentIdFromEvent(event: SortableEvent): string | null {
  return event.item.dataset.documentId ?? null;
}

/**
 * SortableJS 与 Tab 状态之间的适配层。
 *
 * 当前只负责同一窗口内排序；group 与拖拽会话钩子为后续跨窗口
 * Tab 转移保留稳定扩展点。真正顺序仍由调用方的 Tab Store 更新。
 */
export class TabDragManager {
  private readonly root: HTMLElement;
  private readonly options: TabDragManagerOptions;
  private readonly sortable: Sortable;
  private activeSession: TabDragSession | null = null;
  private orderBeforeDrag: string[] = [];
  private orderEndAnchor: ChildNode | null = null;
  private destroyed = false;

  constructor(root: HTMLElement, options: TabDragManagerOptions) {
    this.root = root;
    this.options = options;
    this.sortable = Sortable.create(root, {
      group: {
        name: TAB_DRAG_GROUP,
        pull: true,
        put: true
      },
      draggable: TAB_SELECTOR,
      filter: '.close-button',
      preventOnFilter: false,
      dataIdAttr: 'data-document-id',
      direction: 'horizontal',
      animation: 150,
      easing: 'cubic-bezier(0.2, 0, 0, 1)',
      swapThreshold: 0.55,
      invertSwap: false,
      forceFallback: true,
      fallbackClass: 'tab-drag-fallback',
      fallbackOnBody: true,
      fallbackTolerance: 3,
      ghostClass: 'tab-drag-ghost',
      chosenClass: 'tab-drag-chosen',
      dragClass: 'tab-drag-active',
      onStart: (event) => this.handleStart(event),
      onMove: (event, originalEvent) => this.handleMove(event, originalEvent),
      onEnd: (event) => this.handleEnd(event)
    });
  }

  destroy(): void {
    this.destroyed = true;
    this.clearDragPresentation();
    this.activeSession = null;
    this.sortable.destroy();
  }

  private restoreDomOrder(order: readonly string[], endAnchor: ChildNode | null): void {
    const tabs = new Map(
      [...this.root.querySelectorAll<HTMLElement>(TAB_SELECTOR)].map((tab) => [
        tab.dataset.documentId ?? '',
        tab
      ])
    );
    const insertionPoint = endAnchor?.parentNode === this.root ? endAnchor : null;
    for (const documentId of order) {
      const tab = tabs.get(documentId);
      if (tab) this.root.insertBefore(tab, insertionPoint);
    }
  }

  private handleStart(event: SortableEvent): void {
    const documentId = documentIdFromEvent(event);
    if (!documentId) return;
    this.orderBeforeDrag = this.sortable.toArray();
    const tabs = [...this.root.querySelectorAll<HTMLElement>(TAB_SELECTOR)];
    this.orderEndAnchor = tabs.at(-1)?.nextSibling ?? null;
    this.root.classList.add('tab-list-dragging');
    this.prepareFallbackMirror();
    this.activeSession = { documentId, source: this.root };
    this.options.onDragStart?.(this.activeSession);
  }

  private handleMove(event: MoveEvent, originalEvent: Event): void {
    this.clearDropIndicator();

    const relatedTab = event.related.matches(TAB_SELECTOR) ? event.related : null;
    const insertAfter = event.willInsertAfter === true;

    if (relatedTab && relatedTab !== event.dragged) {
      relatedTab.classList.add(insertAfter ? TAB_DROP_AFTER_CLASS : TAB_DROP_BEFORE_CLASS);
    }

    if (this.activeSession) this.options.onDragMove?.(this.activeSession, originalEvent);
  }

  private handleEnd(event: SortableEvent): void {
    this.clearDragPresentation();
    const documentId = documentIdFromEvent(event);
    if (!documentId) {
      this.activeSession = null;
      this.orderBeforeDrag = [];
      return;
    }

    const oldIndex = this.orderBeforeDrag.indexOf(documentId);
    const newIndex = event.newDraggableIndex;
    if (
      event.from === event.to &&
      oldIndex >= 0 &&
      newIndex !== undefined &&
      oldIndex !== newIndex
    ) {
      // Sortable 先直接移动 DOM，但 Vue 的旧 VNode 仍记录拖拽前顺序。
      // 等 Sortable 完成本次 onEnd 的内部收尾后，再还原 DOM 并修改 Tab 数据，
      // 避免真实 DOM 与 Vue 的旧 VNode 顺序脱节，影响后续新建 Tab 的插入位置。
      const orderBeforeDrag = [...this.orderBeforeDrag];
      const orderEndAnchor = this.orderEndAnchor;
      queueMicrotask(() => {
        if (this.destroyed) return;
        // v-for 的 Tab 位于 Vue Fragment 边界内，不能 append 到结束锚点之后。
        this.restoreDomOrder(orderBeforeDrag, orderEndAnchor);
        this.options.onReorder({ documentId, oldIndex, newIndex });
      });
    }
    this.options.onDragEnd?.(this.activeSession ?? { documentId, source: this.root });
    this.activeSession = null;
    this.orderBeforeDrag = [];
    this.orderEndAnchor = null;
  }

  private prepareFallbackMirror(): void {
    const mirror = Sortable.ghost;
    if (!mirror) return;

    const theme = this.root.closest<HTMLElement>('[data-theme]')?.dataset.theme;
    if (theme) mirror.dataset.theme = theme;
    mirror.setAttribute('aria-hidden', 'true');
  }

  private clearDropIndicator(): void {
    for (const tab of this.root.querySelectorAll<HTMLElement>(TAB_SELECTOR)) {
      tab.classList.remove(...TAB_DROP_CLASSES);
    }
  }

  private clearDragPresentation(): void {
    this.root.classList.remove('tab-list-dragging');
    this.clearDropIndicator();
  }
}
