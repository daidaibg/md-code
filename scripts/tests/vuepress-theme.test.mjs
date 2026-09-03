import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import * as sass from 'sass';
import postcss from 'postcss';

const theme = sass.compile('src/markdown/themes/vuepress/index.scss').css;

test('VuePress resolves every local stylesheet from its entry URL', () => {
  const entry = resolve('src/markdown/themes/vuepress/index.scss');
  const result = sass.compileString(readFileSync(entry, 'utf8'), { url: pathToFileURL(entry) });
  const loaded = new Set(result.loadedUrls.map(url => url.href));
  for (const name of ['tokens', 'content', 'code', 'hints']) {
    assert.ok(loaded.has(pathToFileURL(resolve('src/markdown/themes/vuepress', `_${name}.scss`)).href), `${name} stylesheet must resolve locally`);
  }
  assert.equal(result.css, theme);
});

test('official theme rules remain confined to the Markdown preview host', () => {
  postcss.parse(theme).walkRules(rule => {
    for (const selector of postcss.list.comma(rule.selector)) {
      assert.match(selector.trim(), /^\.md-editor\.markdown-preview-host/);
    }
  });
  assert.doesNotMatch(theme, /\.vuepress-theme\b/);
  assert.doesNotMatch(theme, /\.hljs[\s.{-]/);
  assert.match(theme, /Copyright \(c\) 2018-present, VuePress Community/);
});

test('VuePress keeps its official type scale and responsive reading width', () => {
  const css = postcss.parse(theme);
  const values = new Map();
  css.walkRules(rule => {
    if (rule.parent.type === 'root') rule.walkDecls('font-size', d => values.set(rule.selector, d.value));
  });
  const prefix = '.md-editor.markdown-preview-host .md-editor-preview.vuepress-official-theme';
  assert.equal(values.get(`${prefix} h1`), '32px');
  assert.equal(values.get(`${prefix} h2`), '26.4px');
  assert.equal(values.get(`${prefix} h3`), '21.6px');
  assert.match(theme, /max-width: 820px/);
  assert.match(theme, /@container vuepress-content \(max-width: 419px\)/);
  const shared = sass.compile('src/markdown/themes/typography.scss').css;
  assert.match(shared, /\.md-editor-preview:not\(\.vuepress-official-theme\) h2/);
  assert.match(shared, /\.md-editor-preview \.md-mermaid svg foreignObject p/);
});

test('light/dark palettes and official hint icons are retained without changing saved theme IDs', () => {
  assert.match(theme, /--vp-c-accent: #299764/);
  assert.match(theme, /--vp-c-accent: #3dd68c/);
  assert.match(theme, /--vp-c-bg: #1b1b1f/);
  assert.match(theme, /mask: var\(--vp-hint-icon\)/);
  assert.match(theme, /\.md-admonition-danger/);
  assert.match(theme, /\.md-admonition-important/);
  const registry = readFileSync('src/themes/themeRegistry.ts', 'utf8');
  assert.match(registry, /\['vuepress', 'VuePress 2', 'vuepress-official-theme'\]/);
});
