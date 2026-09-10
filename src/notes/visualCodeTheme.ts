import { HighlightStyle, syntaxHighlighting, language } from '@codemirror/language';
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { highlight } from '@/markdown/core/createMarkdownEngine';

function languageName(view: EditorView): string {
  const name = view.state.facet(language)?.name.toLowerCase() ?? '';
  return ({ 'c++': 'cpp', 'c#': 'csharp', shell: 'bash' } as Record<string, string>)[name] ?? name;
}

const mermaidTokenPattern = /(%%.*$)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|\b(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|subgraph|end|direction|participant|actor|note|loop|alt|else|opt|par|and|critical|break|rect|activate|deactivate|autonumber)\b|\b(TB|TD|BT|RL|LR)\b|(-\.->|==>|-->|---|--|->)|\b([A-Za-z_][\w-]*)(?=\s*[\[({])/gimu;

function mermaidHighlightDecorations(source: string): DecorationSet {
  const ranges: ReturnType<Decoration['range']>[] = [];
  for (const match of source.matchAll(mermaidTokenPattern)) {
    const from = match.index;
    const value = match[0];
    const className = match[1] ? 'hljs-comment'
      : match[2] ? 'hljs-string'
        : match[3] ? 'hljs-keyword'
          : match[4] ? 'hljs-literal'
            : match[5] ? 'hljs-operator'
              : 'hljs-title';
    ranges.push(Decoration.mark({ class: className }).range(from, from + value.length));
  }
  return Decoration.set(ranges, true);
}

function highlightDecorations(view: EditorView, name: string): DecorationSet {
  if (name === 'mermaid') return mermaidHighlightDecorations(view.state.doc.toString());
  const template = document.createElement('template');
  template.innerHTML = highlight(view.state.doc.toString(), name);
  const ranges: ReturnType<Decoration['range']>[] = [];
  let offset = 0;
  function visit(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) { offset += node.textContent?.length ?? 0; return; }
    const start = offset;
    node.childNodes.forEach(visit);
    if (node instanceof HTMLElement && node.className && offset > start) {
      ranges.push(Decoration.mark({ class: node.className }).range(start, offset));
    }
  }
  visit(template.content);
  return Decoration.set(ranges, true);
}

export function createVisualCodeTheme(getLanguage: (view: EditorView) => string | undefined) {
const resolveLanguage = (view: EditorView) => getLanguage(view)?.toLowerCase() ?? languageName(view);
const previewHighlight = ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  name: string;
  constructor(view: EditorView) {
    this.name = resolveLanguage(view);
    this.decorations = highlightDecorations(view, this.name);
  }
  update(update: ViewUpdate): void {
    const name = resolveLanguage(update.view);
    // Selection-only transactions must not replace token DOM or remeasure lines.
    if (!update.docChanged && name === this.name) return;
    this.name = name;
    this.decorations = highlightDecorations(update.view, name);
  }
}, { decorations: value => value.decorations });

// Share the existing Highlight.js palettes while keeping CodeMirror's editable text.
return { extension: [
  EditorView.contentAttributes.of({ class: 'hljs' }),
  EditorView.lineWrapping,
  syntaxHighlighting(HighlightStyle.define([])),
  previewHighlight,
  EditorView.theme({ '&': { overflowAnchor: 'none' } })
] };
}

export function scopeVisualCodeCss(css: string, scope: string): string {
  return css.replace(/(^|\})([^{}]+)\{/gu, (match, boundary: string, selectors: string) => {
    if (selectors.trim().startsWith('@')) return match;
    return `${boundary}${selectors.split(',').map(selector => `${scope} ${selector.trim()}`).join(',')}{`;
  });
}
