import { NodeSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { dropPoint } from '@milkdown/kit/prose/transform';

/** Pointer-based block moves keep Tauri's native file-drop handler available. */
export function createNoteBlockDrag(getView: () => EditorView | undefined, getViewport: () => HTMLElement | undefined) {
  let drag: {
    view: EditorView;
    selection: NodeSelection;
    doc: EditorView['state']['doc'];
    x: number; y: number;
    mouseX: number; mouseY: number;
    active: boolean;
    target: number | null;
  } | undefined;
  let line: HTMLDivElement | undefined;
  let frame = 0;

  function clear(): void {
    if (drag) drag.view.dom.classList.remove('note-block-dragging');
    drag = undefined;
    line?.remove();
    line = undefined;
    cancelAnimationFrame(frame);
    frame = 0;
    window.removeEventListener('mousemove', move, true);
    window.removeEventListener('mouseup', finish, true);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('blur', clear);
  }

  function locate(): void {
    if (!drag) return;
    const { view, doc, selection, mouseX, mouseY } = drag;
    drag.target = null;
    if (line) line.hidden = true;
    if (view.state.doc !== doc || !view.dom.isConnected) { clear(); return; }
    const bounds = getViewport()?.getBoundingClientRect() ?? view.dom.getBoundingClientRect();
    if (mouseX < bounds.left || mouseX > bounds.right || mouseY < bounds.top || mouseY > bounds.bottom) return;
    const editorBounds = view.dom.getBoundingClientRect();
    const hit = view.posAtCoords({ left: Math.max(editorBounds.left + 4, Math.min(editorBounds.right - 4, mouseX)), top: mouseY });
    if (!hit) return;
    const resolved = doc.resolve(hit.pos);
    const depth = Math.min(resolved.depth, selection.$from.depth + 1);
    let target = hit.pos;
    let top = mouseY;
    if (depth > 0) {
      const before = resolved.before(depth);
      const element = view.nodeDOM(before);
      if (element instanceof HTMLElement) {
        const rect = element.getBoundingClientRect();
        const after = mouseY >= rect.top + rect.height / 2;
        target = after ? resolved.after(depth) : before;
        top = after ? rect.bottom : rect.top;
      }
    }
    if (target >= selection.from && target <= selection.to) return;
    const destination = dropPoint(doc, target, selection.content());
    if (destination === null || (destination >= selection.from && destination <= selection.to)) return;
    drag.target = destination;
    if (line) {
      line.hidden = false;
      line.style.top = `${Math.max(bounds.top, Math.min(bounds.bottom - 2, top))}px`;
      line.style.left = `${Math.max(bounds.left + 8, editorBounds.left + 16)}px`;
      line.style.width = `${Math.max(0, Math.min(bounds.right, editorBounds.right) - Math.max(bounds.left, editorBounds.left) - 32)}px`;
    }
  }

  function scroll(): void {
    frame = 0;
    if (!drag?.active) return;
    const viewport = getViewport();
    if (viewport) {
      const rect = viewport.getBoundingClientRect();
      const y = drag.mouseY;
      if (drag.mouseX >= rect.left && drag.mouseX <= rect.right && y >= rect.top && y <= rect.bottom) {
        const speed = y < rect.top + 36 ? -10 : y > rect.bottom - 36 ? 10 : 0;
        if (speed) viewport.scrollTop += speed;
      }
    }
    locate();
    if (drag?.active) frame = requestAnimationFrame(scroll);
  }

  function move(event: MouseEvent): void {
    if (!drag) return;
    if (!(event.buttons & 1)) { clear(); return; }
    drag.mouseX = event.clientX;
    drag.mouseY = event.clientY;
    if (!drag.active && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5) return;
    event.preventDefault();
    if (!drag.active) {
      drag.active = true;
      drag.view.dom.classList.add('note-block-dragging');
      line = document.createElement('div');
      line.setAttribute('aria-hidden', 'true');
      Object.assign(line.style, { position: 'fixed', height: '2px', pointerEvents: 'none', zIndex: '10000', borderRadius: '2px',
        background: getComputedStyle(drag.view.dom).getPropertyValue('--accent').trim() || '#1677ff' });
      document.body.appendChild(line);
      frame = requestAnimationFrame(scroll);
    }
    locate();
  }

  function finish(event: MouseEvent): void {
    if (!drag || event.button !== 0) return;
    drag.mouseX = event.clientX;
    drag.mouseY = event.clientY;
    locate();
    const current = drag;
    clear();
    if (!current?.active || current.target === null || current.view.state.doc !== current.doc) return;
    event.preventDefault();
    const { view, selection, target } = current;
    const slice = selection.content();
    const transaction = view.state.tr.delete(selection.from, selection.to);
    const destination = dropPoint(transaction.doc, transaction.mapping.map(target), slice);
    if (destination === null) return; // Never dispatch a deletion without a valid insertion.
    transaction.replaceRange(destination, destination, slice);
    const node = transaction.doc.nodeAt(destination);
    if (node && NodeSelection.isSelectable(node)) transaction.setSelection(NodeSelection.create(transaction.doc, destination));
    view.dispatch(transaction.scrollIntoView());
    view.focus();
  }

  function onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); clear(); }
  }

  function start(event: MouseEvent): void {
    const handle = (event.target as Element | null)?.closest('.milkdown-block-handle .operation-item:last-child');
    if (!handle || event.button !== 0) return;
    const view = getView();
    // Milkdown's handle mousedown has already selected the exact block before bubbling here.
    if (!view || !(view.state.selection instanceof NodeSelection)) return;
    clear();
    event.preventDefault();
    drag = { view, selection: view.state.selection, doc: view.state.doc, x: event.clientX, y: event.clientY,
      mouseX: event.clientX, mouseY: event.clientY, active: false, target: null };
    window.addEventListener('mousemove', move, true);
    window.addEventListener('mouseup', finish, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('blur', clear);
  }

  function preventNativeDrag(event: DragEvent): void {
    if ((event.target as Element | null)?.closest('.milkdown-block-handle')) {
      event.preventDefault();
      event.stopPropagation();
    }
  }
  return { start, preventNativeDrag, destroy: clear };
}
