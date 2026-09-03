import { onBeforeUnmount, watch, type Ref } from 'vue';
import { createScrollAnchors, mapScrollPosition, type ContentScrollPosition, type ScrollAnchor } from './contentScroll';

interface SourceEditor {
  getScrollPosition: () => ContentScrollPosition;
  scrollToSourcePosition: (position: ContentScrollPosition) => void;
}

export function useContentScrollSync(options: {
  preview: Ref<HTMLElement | undefined>;
  editor: Ref<SourceEditor | undefined>;
  enabled: () => boolean;
  source: () => string;
}) {
  let anchors: ScrollAnchor[] = [];
  let dirty = true;
  let frame = 0;
  let expectedPreviewTop: number | null = null;
  let lastPreviewTop = 0;
  let driver: 'editor' | 'preview' = 'editor';
  let resizeObserver: ResizeObserver | undefined;
  let mutationObserver: MutationObserver | undefined;

  function measure(): void {
    const root = options.preview.value;
    if (!root || !dirty) return;
    const origin = root.getBoundingClientRect().top + root.clientTop;
    const blocks = [...root.querySelectorAll<HTMLElement>('[data-source-line][data-source-end]')]
      .filter(element => element.getClientRects().length > 0)
      .map(element => {
        const rect = element.getBoundingClientRect();
        return {
          start: Number(element.dataset.sourceLine), end: Number(element.dataset.sourceEnd),
          top: rect.top - origin + root.scrollTop, bottom: rect.bottom - origin + root.scrollTop
        };
      });
    anchors = createScrollAnchors(blocks, options.source().split('\n').length + 1, root.scrollHeight);
    dirty = false;
  }

  function synchronize(): void {
    frame = 0;
    const root = options.preview.value;
    const editor = options.editor.value;
    if (!root || !editor || !options.enabled()) return;
    measure();
    if (driver === 'editor') {
      const position = editor.getScrollPosition();
      const max = Math.max(0, root.scrollHeight - root.clientHeight);
      const top = position.edge === 'start' ? 0 : position.edge === 'end' ? max : mapScrollPosition(anchors, position.line, 'line');
      expectedPreviewTop = Math.max(0, Math.min(max, top));
      root.scrollTop = expectedPreviewTop;
      expectedPreviewTop = root.scrollTop;
    } else {
      const max = Math.max(0, root.scrollHeight - root.clientHeight);
      // A preview without vertical overflow must not reset a scrollable editor.
      if (max <= 1) return;
      editor.scrollToSourcePosition({
        line: mapScrollPosition(anchors, root.scrollTop, 'top'),
        edge: root.scrollTop <= 1 ? 'start' : root.scrollTop >= max - 1 ? 'end' : undefined
      });
    }
  }

  function schedule(): void {
    if (!frame) frame = requestAnimationFrame(synchronize);
  }

  function invalidate(): void {
    dirty = true;
    schedule();
  }

  function onEditorScroll(): void {
    if (!options.enabled()) return;
    driver = 'editor';
    schedule();
  }

  function onPreviewScroll(): void {
    const root = options.preview.value;
    if (!root || !options.enabled()) return;
    if (Math.abs(root.scrollTop - lastPreviewTop) < 0.5) return;
    lastPreviewTop = root.scrollTop;
    // Browser scroll events may arrive after RAF. Match the actual target rather
    // than unlocking after one frame, which creates feedback and oscillation.
    if (expectedPreviewTop !== null && Math.abs(root.scrollTop - expectedPreviewTop) <= 1) return;
    expectedPreviewTop = null;
    driver = 'preview';
    schedule();
  }

  watch(options.preview, root => {
    resizeObserver?.disconnect();
    mutationObserver?.disconnect();
    expectedPreviewTop = null;
    lastPreviewTop = root?.scrollTop ?? 0;
    if (root) {
      resizeObserver = new ResizeObserver(invalidate);
      const observeContent = () => {
        resizeObserver?.disconnect();
        resizeObserver?.observe(root);
        for (const child of root.children) resizeObserver?.observe(child);
      };
      observeContent();
      mutationObserver = new MutationObserver(() => { observeContent(); invalidate(); });
      mutationObserver.observe(root, {
        childList: true, subtree: true, characterData: true,
        attributes: true, attributeFilter: ['class', 'src', 'data-source-line', 'data-source-end']
      });
    }
    invalidate();
  }, { flush: 'post', immediate: true });

  watch([options.source, options.enabled], invalidate, { flush: 'post' });

  onBeforeUnmount(() => {
    resizeObserver?.disconnect();
    mutationObserver?.disconnect();
    if (frame) cancelAnimationFrame(frame);
  });

  return { onEditorScroll, onPreviewScroll };
}
