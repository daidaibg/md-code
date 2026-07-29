import type MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';

function inlineText(token: Token | undefined): string {
  if (!token) return '';
  if (!token.children) return token.content;
  return token.children
    .filter((child) => ['text', 'code_inline', 'emoji'].includes(child.type))
    .map((child) => child.content)
    .join('')
    .trim();
}

export function slugifyHeading(text: string): string {
  const slug = text
    .trim()
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/[\s_]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  return slug || 'section';
}

export function headingAnchorPlugin(markdown: MarkdownIt): void {
  markdown.core.ruler.push('heading_anchors', (state) => {
    const counts = new Map<string, number>();

    for (let index = 0; index < state.tokens.length; index += 1) {
      const token = state.tokens[index];
      if (token.type !== 'heading_open') continue;
      const base = slugifyHeading(inlineText(state.tokens[index + 1]));
      const count = (counts.get(base) ?? 0) + 1;
      counts.set(base, count);
      token.attrSet('id', count === 1 ? base : `${base}-${count}`);
    }
  });
}
