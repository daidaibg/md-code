import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import css from 'highlight.js/lib/languages/css';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdownLanguage from 'highlight.js/lib/languages/markdown';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import scss from 'highlight.js/lib/languages/scss';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import { katex } from '@mdit/plugin-katex';
import { tasklist } from '@mdit/plugin-tasklist';
import { MarkdownPluginRegistry } from './pluginRegistry';
import { admonitionPlugin } from '@/markdown/plugins/admonition';
import { mermaidFencePlugin } from '@/markdown/plugins/mermaidFence';
import { headingAnchorPlugin } from '@/markdown/plugins/headingAnchors';

const languages = {
  bash,
  cpp,
  csharp,
  css,
  java,
  javascript,
  json,
  markdown: markdownLanguage,
  python,
  rust,
  scss,
  sql,
  typescript,
  xml,
  yaml
};

for (const [name, language] of Object.entries(languages)) hljs.registerLanguage(name, language);
hljs.registerAliases(['js', 'jsx'], { languageName: 'javascript' });
hljs.registerAliases(['ts', 'tsx'], { languageName: 'typescript' });
hljs.registerAliases(['html', 'vue'], { languageName: 'xml' });
hljs.registerAliases(['sh', 'shell'], { languageName: 'bash' });
hljs.registerAliases(['yml'], { languageName: 'yaml' });

function highlight(source: string, language: string): string {
  if (language && hljs.getLanguage(language)) {
    return hljs.highlight(source, { language, ignoreIllegals: true }).value;
  }
  return hljs.highlightAuto(source).value;
}

function codeFencePresentationPlugin(markdown: MarkdownIt): void {
  markdown.renderer.rules.fence = (tokens, index) => {
    const token = tokens[index];
    const language = token.info.trim().split(/\s+/u)[0]?.toLowerCase() || 'text';
    const languageClass = language === 'text' ? '' : ` language-${markdown.utils.escapeHtml(language)}`;
    const highlighted = highlight(token.content, language === 'text' ? '' : language);
    const languageLabel = markdown.utils.escapeHtml(language);

    return [
      '<div class="md-editor-code">',
      '<div class="md-editor-code-head">',
      '<div class="md-editor-code-flag"><span></span><span></span><span></span></div>',
      '<div class="md-editor-code-action">',
      `<span class="md-editor-code-lang">${languageLabel}</span>`,
      '<button class="md-editor-copy-button" type="button" data-copy-code>复制</button>',
      '</div>',
      '</div>',
      `<pre data-language="${languageLabel}"><code class="hljs${languageClass}">${highlighted}</code></pre>`,
      '</div>\n'
    ].join('');
  };
}

export function createMarkdownEngine(
  extend?: (registry: MarkdownPluginRegistry) => void
): MarkdownIt {
  const markdown = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    breaks: false,
    highlight
  });

  const registry = new MarkdownPluginRegistry()
    .register({ name: 'heading-anchors', setup: (instance) => instance.use(headingAnchorPlugin) })
    .register(admonitionPlugin)
    .register({ name: 'katex', setup: (instance) => instance.use(katex) })
    .register({
      name: 'task-list',
      setup: (instance) => instance.use(tasklist, { disabled: true, label: true })
    })
    .register({ name: 'code-fence-presentation', setup: codeFencePresentationPlugin })
    .register(mermaidFencePlugin);

  extend?.(registry);
  registry.install(markdown);
  return markdown;
}
