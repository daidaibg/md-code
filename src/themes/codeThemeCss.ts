import type { CodeThemeName, ResolvedTheme } from '@/types/editor';

import a11yLight from 'highlight.js/styles/a11y-light.css?inline';
import a11yDark from 'highlight.js/styles/a11y-dark.css?inline';
import atomLight from 'highlight.js/styles/atom-one-light.css?inline';
import atomDark from 'highlight.js/styles/atom-one-dark.css?inline';
import githubLight from 'highlight.js/styles/github.css?inline';
import githubDark from 'highlight.js/styles/github-dark.css?inline';
import gradientLight from 'highlight.js/styles/gradient-light.css?inline';
import gradientDark from 'highlight.js/styles/gradient-dark.css?inline';
import kimbieLight from 'highlight.js/styles/kimbie-light.css?inline';
import kimbieDark from 'highlight.js/styles/kimbie-dark.css?inline';
import paraisoLight from 'highlight.js/styles/paraiso-light.css?inline';
import paraisoDark from 'highlight.js/styles/paraiso-dark.css?inline';
import qtcreatorLight from 'highlight.js/styles/qtcreator-light.css?inline';
import qtcreatorDark from 'highlight.js/styles/qtcreator-dark.css?inline';
import stackoverflowLight from 'highlight.js/styles/stackoverflow-light.css?inline';
import stackoverflowDark from 'highlight.js/styles/stackoverflow-dark.css?inline';

interface CodeThemePair {
  light: string;
  dark: string;
}

const builtInCodeThemeCss: Record<string, CodeThemePair> = {
  a11y: { light: a11yLight, dark: a11yDark },
  atom: { light: atomLight, dark: atomDark },
  github: { light: githubLight, dark: githubDark },
  gradient: { light: gradientLight, dark: gradientDark },
  kimbie: { light: kimbieLight, dark: kimbieDark },
  paraiso: { light: paraisoLight, dark: paraisoDark },
  qtcreator: { light: qtcreatorLight, dark: qtcreatorDark },
  stackoverflow: { light: stackoverflowLight, dark: stackoverflowDark }
};

const customCodeThemeCss = new Map<string, CodeThemePair>();

export function registerCodeThemeCss(id: string, css: CodeThemePair): void {
  customCodeThemeCss.set(id, css);
}

function removeHighlightSurface(css: string): string {
  return css.replace(
    /((?:^|\})\s*\.hljs\s*\{)([^}]*)(\})/gu,
    (_match, opening: string, declarations: string, closing: string) => {
      const syntaxOnly = declarations
        .split(';')
        .filter((declaration) => !/^\s*background(?:-color)?\s*:/iu.test(declaration))
        .join(';');
      return `${opening}${syntaxOnly}${closing}`;
    }
  );
}

export function resolveCodeThemeCss(id: CodeThemeName, theme: ResolvedTheme): string {
  const pair = customCodeThemeCss.get(id) ?? builtInCodeThemeCss[id] ?? builtInCodeThemeCss.github;
  // 与 md-editor-v3 一致：代码风格只提供 Highlight.js 的文字/token 配色。
  // 代码块表面、头部和边框继续由 Markdown 预览主题统一管理。
  return removeHighlightSurface(pair[theme]);
}

