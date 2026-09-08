import MarkdownIt from 'markdown-it';
import type { Literal, Root } from 'mdast';
import type { Options } from 'mdast-util-to-markdown';
import { $node, $remark, $view } from '@milkdown/kit/utils';
import { TextSelection } from '@milkdown/kit/prose/state';
import { createAdmonitionPlugin, openingMarker } from '@/markdown/plugins/admonition';

interface NoteAdmonition extends Literal {
  type: 'noteAdmonition';
  opening: string;
  closing: string;
}
declare module 'mdast' {
  interface BlockContentMap { noteAdmonition: NoteAdmonition }
  interface RootContentMap { noteAdmonition: NoteAdmonition }
}

const markdown = new MarkdownIt();
createAdmonitionPlugin().setup(markdown);
const titles: Record<string, string> = { tip: '技巧', note: '提示', info: '信息', warning: '警告', danger: '危险' };

// The body is deliberately plain Markdown, like a code block. Parsing it as
// rich text would lose extensions that the visual editor cannot round-trip.
export const visualAdmonition = $node('note_admonition', () => ({
  group: 'block', content: 'text*', marks: '', code: true, defining: true,
  attrs: { opening: { default: '!!! note' }, closing: { default: '!!!' } },
  parseDOM: [{
    tag: 'aside[data-note-admonition]', contentElement: '.note-admonition-source', preserveWhitespace: 'full',
    getAttrs: dom => ({ opening: dom.getAttribute('data-opening'), closing: dom.getAttribute('data-closing') })
  }],
  toDOM: node => {
    const marker = openingMarker(String(node.attrs.opening).trimStart());
    const kind = marker?.kind.toLowerCase() ?? 'note';
    const colorKind = kind in titles ? kind : 'note';
    return ['aside', {
      class: `md-admonition md-admonition-${colorKind} note-admonition`,
      'data-note-admonition': '', 'data-opening': node.attrs.opening, 'data-closing': node.attrs.closing
    }, ['div', { class: 'md-admonition-title', contenteditable: 'false' },
      ['span', { class: 'md-admonition-marker', 'aria-hidden': 'true' }],
      ['span', marker?.title || titles[kind] || kind]
    ], ['pre', { class: 'md-admonition-content note-admonition-source', spellcheck: 'false' }, 0]];
  },
  parseMarkdown: {
    match: node => node.type === 'noteAdmonition',
    runner: (state, node, type) => {
      state.openNode(type, { opening: node.opening, closing: node.closing });
      if (node.value) state.addText(String(node.value));
      state.closeNode();
    }
  },
  toMarkdown: {
    match: node => node.type.name === 'note_admonition',
    runner: (state, node) => { state.addNode('noteAdmonition', undefined, node.textContent, {
      opening: node.attrs.opening, closing: node.attrs.closing
    }); }
  }
}));

export const visualAdmonitionView = $view(visualAdmonition, () => (initialNode, view, getPos) => {
  let node = initialNode;
  const dom = document.createElement('aside');
  const header = document.createElement('div');
  header.className = 'md-admonition-title';
  header.contentEditable = 'false';
  const markerIcon = document.createElement('span');
  markerIcon.className = 'md-admonition-marker';
  markerIcon.setAttribute('aria-hidden', 'true');
  const title = document.createElement('input');
  title.className = 'note-admonition-title-input';
  title.setAttribute('aria-label', '提示块标题');
  title.title = '修改提示块标题';
  const contentDOM = document.createElement('pre');
  contentDOM.className = 'md-admonition-content note-admonition-source';
  contentDOM.spellcheck = false;
  header.append(markerIcon, title);
  dom.append(header, contentDOM);
  const listeners = new AbortController();
  function sync() {
    const marker = openingMarker(String(node.attrs.opening).trimStart());
    const kind = marker?.kind.toLowerCase() ?? 'note';
    // Preserve ProseMirror's decoration classes (first block, selection, etc.).
    for (const name of [...dom.classList]) if (name.startsWith('md-admonition-')) dom.classList.remove(name);
    dom.classList.add('md-admonition', 'note-admonition', `md-admonition-${kind in titles ? kind : 'note'}`);
    dom.dataset.noteAdmonition = '';
    dom.dataset.opening = String(node.attrs.opening);
    dom.dataset.closing = String(node.attrs.closing);
    const value = marker?.title ?? '';
    if (title.value !== value) title.value = value;
    title.placeholder = titles[kind] || kind;
    title.readOnly = !view.editable;
  }
  title.addEventListener('input', () => {
    const pos = getPos();
    const marker = openingMarker(String(node.attrs.opening).trimStart());
    if (pos === undefined || !marker || !view.editable) return;
    const opening = `${marker.fence} ${marker.kind}${title.value ? ` ${JSON.stringify(title.value)}` : ''}`;
    view.dispatch(view.state.tr.setNodeAttribute(pos, 'opening', opening));
  }, { signal: listeners.signal });
  title.addEventListener('keydown', event => {
    if (event.isComposing || !['Enter', 'Escape'].includes(event.key)) return;
    event.preventDefault();
    const pos = getPos();
    if (pos === undefined) return;
    view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(pos + 1))));
    view.focus();
  }, { signal: listeners.signal });
  sync();
  return {
    dom, contentDOM,
    update(nextNode) {
      if (nextNode.type !== node.type) return false;
      node = nextNode;
      sync();
      return true;
    },
    stopEvent: event => event.target instanceof globalThis.Node && header.contains(event.target),
    ignoreMutation: mutation => mutation.type === 'selection'
      ? header.contains(mutation.target)
      : mutation.target !== contentDOM && !contentDOM.contains(mutation.target),
    destroy: () => listeners.abort()
  };
});

export const remarkVisualAdmonition = $remark('note-admonition', () => function () {
  const processor = this;
  const extensions = processor.data('toMarkdownExtensions') ?? [];
  const extension: Options = {
    handlers: { noteAdmonition: node => `${node.opening}\n${node.value}\n${node.closing}` }
  };
  processor.data('toMarkdownExtensions', [...extensions, extension]);
  return (tree: Root, file) => {
    const source = String(file);
    const lines = source.split('\n');
    const tokens = markdown.parse(source, {});
    const ranges: [number, number][] = [];
    for (const token of tokens) {
      if (token.type !== 'admonition_open' || !token.map) continue;
      if (ranges.some(([start, end]) => token.map![0] >= start && token.map![1] <= end)) continue;
      if (token.level !== 0) throw new Error('嵌套在列表或引用中的提示块请使用源码编辑，原文已保留。');
      ranges.push(token.map);
    }
    for (const token of tokens) {
      if (token.type !== 'inline' || !token.map || ranges.some(([from, to]) => token.map![0] >= from && token.map![1] <= to)) continue;
      if (token.content.split(/\r?\n/u).some(line => openingMarker(line.trimStart()) !== null)) {
        throw new Error('提示块标记尚未闭合或嵌套方式暂不支持，已保留源码，避免转换原文。');
      }
    }
    if (!ranges.length) return;
    const children: Root['children'] = [];
    const offsets = [0];
    for (const line of lines) offsets.push(offsets[offsets.length - 1] + line.length + 1);
    function parsePart(from: number, to: number) {
      const part = processor.parse(lines.slice(from, to).join('\n')) as Root;
      function relocate(node: { position?: Root['position']; children?: unknown[] }) {
        if (node.position) for (const point of [node.position.start, node.position.end]) {
          point.line += from;
          if (point.offset !== undefined) point.offset += offsets[from];
        }
        node.children?.forEach(child => relocate(child as Parameters<typeof relocate>[0]));
      }
      relocate(part);
      return part.children;
    }
    let start = 0;
    for (const [from, to] of ranges) {
      children.push(...parsePart(start, from));
      children.push({ type: 'noteAdmonition', opening: lines[from].replace(/\r$/u, ''),
        closing: lines[to - 1].replace(/\r$/u, ''),
        position: { start: { line: from + 1, column: 1, offset: offsets[from] },
          end: { line: to, column: lines[to - 1].length + 1, offset: offsets[to - 1] + lines[to - 1].length } },
        value: lines.slice(from + 1, to - 1).join('\n').replace(/\r\n/gu, '\n').replace(/\r$/u, '') });
      start = to;
    }
    children.push(...parsePart(start, lines.length));
    tree.children = children;
  };
});
