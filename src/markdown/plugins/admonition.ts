import type MarkdownIt from 'markdown-it';
import type StateBlock from 'markdown-it/lib/rules_block/state_block.mjs';
import type { MarkdownPlugin } from '@/markdown/core/pluginRegistry';
import {
  installAdmonitionRenderer,
  type AdmonitionRendererOptions
} from '@/markdown/renderer/admonitionRenderer';

export interface AdmonitionPluginOptions extends AdmonitionRendererOptions {}

interface OpeningMarker {
  fence: string;
  kind: string;
  title: string;
}

function lineText(state: StateBlock, line: number): string {
  const start = state.bMarks[line] + state.tShift[line];
  return state.src.slice(start, state.eMarks[line]);
}

export function openingMarker(source: string): OpeningMarker | null {
  const match = /^(!!!|！！！|:::)[ \t]([^\s!！:"']+)(?:[ \t]+(.+?))?[ \t]*$/u.exec(source);
  if (!match) return null;

  const fence = match[1];
  const kind = match[2];
  const argument = match[3]?.trim() ?? '';
  const quoted = /^(["'])([\s\S]*)\1$/u.exec(argument);
  let title = quoted?.[2] ?? argument;
  if (quoted?.[1] === '"') {
    try { title = JSON.parse(argument) as string; } catch { /* Preserve existing unescaped titles. */ }
  }
  return { fence, kind, title };
}

function isClosingMarker(source: string, fence: string): boolean {
  return source.trimEnd() === fence;
}

function admonitionBlock(
  state: StateBlock,
  startLine: number,
  endLine: number,
  silent: boolean
): boolean {
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;

  const marker = openingMarker(lineText(state, startLine));
  if (!marker) return false;

  let closeLine = startLine + 1;
  let depth = 1;
  let codeFence = '';
  for (; closeLine < endLine; closeLine += 1) {
    const line = lineText(state, closeLine);
    const code = /^(`{3,}|~{3,})(.*)$/u.exec(line);
    if (codeFence) {
      if (code && code[1][0] === codeFence[0] && code[1].length >= codeFence.length && !code[2].trim()) codeFence = '';
      continue;
    }
    if (code) { codeFence = code[1]; continue; }
    if (openingMarker(line)?.fence === marker.fence) depth += 1;
    if (isClosingMarker(line, marker.fence) && --depth === 0) break;
  }
  if (closeLine >= endLine) return false;
  if (silent) return true;

  const open = state.push('admonition_open', 'aside', 1);
  open.block = true;
  open.map = [startLine, closeLine + 1];
  open.markup = marker.fence;
  open.info = marker.kind;
  open.attrSet('kind', marker.kind);
  if (marker.title) open.attrSet('title', marker.title);
  open.meta = { kind: marker.kind, title: marker.title };

  state.md.block.tokenize(state, startLine + 1, closeLine);

  const close = state.push('admonition_close', 'aside', -1);
  close.block = true;
  close.markup = marker.fence;
  close.info = marker.kind;
  close.meta = open.meta;

  state.line = closeLine + 1;
  return true;
}

export function createAdmonitionPlugin(
  options: AdmonitionPluginOptions = {}
): MarkdownPlugin {
  return {
    name: 'admonition',
    setup(markdown: MarkdownIt): void {
      markdown.block.ruler.before('fence', 'admonition', admonitionBlock, {
        alt: ['paragraph', 'reference', 'blockquote', 'list']
      });
      installAdmonitionRenderer(markdown, options);
    }
  };
}

export const admonitionPlugin = createAdmonitionPlugin();
