import type MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';
import type { TocItem } from '@/types/editor';

function tokenText(token: Token | undefined): string {
  if (!token) return '';
  if (!token.children) return token.content;
  return token.children
    .filter((child) => ['text', 'code_inline', 'emoji'].includes(child.type))
    .map((child) => child.content)
    .join('')
    .trim();
}

export function extractHeadings(markdown: MarkdownIt, source: string): TocItem[] {
  const tokens = markdown.parse(source, {});
  const headings: TocItem[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type !== 'heading_open') continue;
    const id = token.attrGet('id');
    if (!id) continue;
    headings.push({
      id,
      level: Number(token.tag.slice(1)),
      text: tokenText(tokens[index + 1])
    });
  }

  return headings;
}
