import { HighlightStyle, syntaxHighlighting, language } from '@codemirror/language';
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { highlight } from '@/markdown/core/createMarkdownEngine';

function languageName(view: EditorView): string {
  const name = view.state.facet(language)?.name.toLowerCase() ?? '';
  return ({ 'c++': 'cpp', 'c#': 'csharp', shell: 'bash' } as Record<string, string>)[name] ?? name;
}

function highlightDecorations(view: EditorView, name: string): DecorationSet {
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
