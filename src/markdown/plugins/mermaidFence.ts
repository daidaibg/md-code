import type MarkdownIt from 'markdown-it';
import type { MarkdownPlugin } from '@/markdown/core/pluginRegistry';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export const mermaidFencePlugin: MarkdownPlugin = {
  name: 'mermaid-fence',
  setup(markdown: MarkdownIt) {
    const fallback = markdown.renderer.rules.fence?.bind(markdown.renderer.rules);

    markdown.renderer.rules.fence = (tokens, index, options, env, self) => {
      const token = tokens[index];
      const language = token.info.trim().split(/\s+/u)[0]?.toLowerCase();

      if (language !== 'mermaid') {
        return fallback
          ? fallback(tokens, index, options, env, self)
          : self.renderToken(tokens, index, options);
      }

      return `<div class="md-mermaid" data-mermaid-pending="true"><pre class="md-mermaid-source">${escapeHtml(token.content)}</pre></div>`;
    };
  }
};
