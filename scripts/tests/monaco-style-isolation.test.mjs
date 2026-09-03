import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as sass from 'sass';
import postcss from 'postcss';
import { parse } from '@vue/compiler-sfc';

test('editor integration styles only its host, never Monaco internals', () => {
  const source = readFileSync('src/editor/monaco/MonacoEditor.vue', 'utf8');
  const { descriptor } = parse(source);
  for (const style of descriptor.styles) {
    postcss.parse(style.content).walkRules(rule => assert.equal(rule.selector, '.monaco-editor-host'));
  }
  const layout = readFileSync('src/editor/components/DocumentEditor.vue', 'utf8');
  assert.doesNotMatch(layout, /:has\(\.monaco-hover/);
});

test('application box-model and input-font resets exclude editors and popup components', () => {
  const css = postcss.parse(sass.compile('src/themes/global.scss').css);
  let boxReset = false;
  let fontReset = false;
  css.walkRules(rule => {
    const isBoxReset = rule.nodes.some(node => node.prop === 'box-sizing');
    const isFontReset = rule.nodes.some(node => node.prop === 'font' && node.value === 'inherit');
    if (!isBoxReset && !isFontReset) return;
    assert.match(rule.selector, /:not\(:where\(\.monaco-editor, \.monaco-editor \*, \.monaco-component, \.monaco-component \*\)\)/);
    boxReset ||= isBoxReset;
    fontReset ||= isFontReset;
  });
  assert.ok(boxReset && fontReset);
});

test('installed Monaco owns reduced-width match-count visibility', () => {
  const css = postcss.parse(readFileSync('node_modules/monaco-editor/esm/vs/editor/contrib/find/browser/findWidget.css', 'utf8'));
  let found = false;
  css.walkRules('.monaco-editor .find-widget.reduced-find-widget .matchesCount', rule => {
    found = rule.nodes.some(node => node.prop === 'display' && node.value === 'none');
  });
  assert.ok(found);
});
