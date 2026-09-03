import assert from 'node:assert/strict';
import test from 'node:test';
import * as sass from 'sass';
import postcss from 'postcss';

const css = postcss.parse(sass.compile('src/themes/scrollbars.scss').css);

test('thumb color is animated on the whole scrollable content surface', () => {
  let registered = false;
  let transition = false;
  let contentHover = false;
  css.walkAtRules('property', rule => {
    if (rule.params !== '--app-scrollbar-thumb') return;
    registered = rule.nodes.some(node => node.prop === 'syntax' && node.value.includes('<color>'));
  });
  css.walkRules(rule => {
    if (postcss.list.comma(rule.selector).includes('.app-scrollbar')) {
      transition ||= rule.nodes.some(node => node.prop === 'transition' && node.value === '--app-scrollbar-thumb 450ms ease');
    }
    if (postcss.list.comma(rule.selector).includes('.app-scrollbar:hover')) {
      contentHover = rule.nodes.some(node => node.prop === '--app-scrollbar-thumb' && node.value === 'var(--content-scrollbar-thumb)');
    }
  });
  assert.ok(registered && transition && contentHover);
});

test('tracks stay transparent and default thumb color is hidden', () => {
  let defaultHidden = false;
  css.walkRules(rule => {
    if (rule.selector.includes('::-webkit-scrollbar-track')) {
      assert.ok(rule.nodes.some(node => node.prop === 'background' && node.value === 'transparent'));
    }
    if (postcss.list.comma(rule.selector).includes('.app-scrollbar')) {
      defaultHidden ||= rule.nodes.some(node => node.prop === '--app-scrollbar-thumb' && node.value === 'transparent');
    }
  });
  assert.ok(defaultHidden);
});

test('styles are opt-in for content scrollers, with no Monaco or universal overrides', () => {
  css.walkRules(rule => {
    assert.doesNotMatch(rule.selector, /monaco|\*/);
  });
  css.walkDecls('transition', declaration => {
    assert.notEqual(declaration.value, 'none', 'content scrollbar fade must remain enabled');
  });
});
