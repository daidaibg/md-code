import type MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';

function withSourceLines(html: string, token: Token): string {
  if (!token.map || !token.block || token.hidden || token.nesting < 0 || token.type === 'inline') return html;
  return html.replace(/^<([a-z][\w:-]*)([^>]*?)>/iu, (opening, tag: string, attributes: string) => {
    if (attributes.includes('data-source-line=')) return opening;
    return `<${tag} data-source-line="${token.map![0] + 1}" data-source-end="${token.map![1] + 1}"${attributes}>`;
  });
}

/** Install last: custom code, diagram and math renderers also need source ranges. */
export function sourceLinesPlugin(markdown: MarkdownIt): void {
  const renderToken = markdown.renderer.renderToken.bind(markdown.renderer);
  markdown.renderer.renderToken = (tokens, index, options) =>
    withSourceLines(renderToken(tokens, index, options), tokens[index]);

  for (const [name, render] of Object.entries(markdown.renderer.rules)) {
    if (!render) continue;
    markdown.renderer.rules[name] = (tokens, index, options, env, self) =>
      withSourceLines(render(tokens, index, options, env, self), tokens[index]);
  }
}
