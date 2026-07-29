import type MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';

export interface AdmonitionTokenMeta {
  kind: string;
  title: string;
}

export interface AdmonitionRenderContext extends AdmonitionTokenMeta {
  token: Token;
}

export interface AdmonitionRendererOptions {
  renderOpen?: (context: AdmonitionRenderContext, markdown: MarkdownIt) => string;
  renderClose?: (token: Token, markdown: MarkdownIt) => string;
  resolveTitle?: (kind: string) => string;
}

const defaultTitles: Record<string, string> = {
  note: '提示',
  info: '信息',
  tip: '技巧',
  warning: '警告',
  danger: '危险'
};

function cssKind(kind: string): string {
  return kind.toLowerCase().replace(/[^\p{Letter}\p{Number}_-]+/gu, '-');
}

function tokenMeta(token: Token, options: AdmonitionRendererOptions): AdmonitionTokenMeta {
  const kind = token.attrGet('kind') || 'note';
  const title =
    token.attrGet('title') || options.resolveTitle?.(kind) || defaultTitles[kind] || kind;
  return { kind, title };
}

export function installAdmonitionRenderer(
  markdown: MarkdownIt,
  options: AdmonitionRendererOptions = {}
): void {
  markdown.renderer.rules.admonition_open = (tokens, index) => {
    const token = tokens[index];
    const meta = tokenMeta(token, options);
    const context: AdmonitionRenderContext = { ...meta, token };
    if (options.renderOpen) return options.renderOpen(context, markdown);

    const escapedKind = markdown.utils.escapeHtml(meta.kind);
    const escapedTitle = markdown.utils.escapeHtml(meta.title);
    return [
      `<aside class="md-admonition md-admonition-${cssKind(meta.kind)}" data-admonition-kind="${escapedKind}">`,
      '<div class="md-admonition-title">',
      '<span class="md-admonition-marker" aria-hidden="true"></span>',
      `<span>${escapedTitle}</span>`,
      '</div>',
      '<div class="md-admonition-content">\n'
    ].join('');
  };

  markdown.renderer.rules.admonition_close = (tokens, index) => {
    const token = tokens[index];
    return options.renderClose?.(token, markdown) ?? '</div></aside>\n';
  };
}
