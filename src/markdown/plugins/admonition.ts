import type MarkdownIt from 'markdown-it';
import type StateBlock from 'markdown-it/lib/rules_block/state_block.mjs';
import type { MarkdownPlugin } from '@/markdown/core/pluginRegistry';
import {
  installAdmonitionRenderer,
  type AdmonitionRendererOptions
} from '@/markdown/renderer/admonitionRenderer';

export interface AdmonitionPluginOptions extends AdmonitionRendererOptions {}

interface OpeningMarker {
  kind: string;
  title: string;
}

function lineText(state: StateBlock, line: number): string {
  const start = state.bMarks[line] + state.tShift[line];
  return state.src.slice(start, state.eMarks[line]);
}

function openingMarker(source: string): OpeningMarker | null {
  const match = /^!!![ \t]+([^\s"']+)(?:[ \t]+(.+?))?[ \t]*$/u.exec(source);
  if (!match) return null;

  const kind = match[1];
  const argument = match[2]?.trim() ?? '';
  const quoted = /^(["'])([\s\S]*)\1$/u.exec(argument);
  return { kind, title: quoted?.[2] ?? argument };
}

function isClosingMarker(source: string): boolean {
  return /^!!![ \t]*$/u.test(source);
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
  while (closeLine < endLine && !isClosingMarker(lineText(state, closeLine))) closeLine += 1;
  if (closeLine >= endLine) return false;
  if (silent) return true;

  const open = state.push('admonition_open', 'aside', 1);
  open.block = true;
  open.map = [startLine, closeLine + 1];
  open.markup = '!!!';
  open.info = marker.kind;
  open.attrSet('kind', marker.kind);
  if (marker.title) open.attrSet('title', marker.title);
  open.meta = { kind: marker.kind, title: marker.title };

  state.md.block.tokenize(state, startLine + 1, closeLine);

  const close = state.push('admonition_close', 'aside', -1);
  close.block = true;
  close.markup = '!!!';
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
