import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parse, compileScript, compileStyle } from '@vue/compiler-sfc';
import { scrollGeometry, scrollFromThumb } from '../../src/components/scroll/scrollGeometry.ts';

test('thumb uses content size, clamps at both ends and round-trips drag positions', () => {
  const geometry = scrollGeometry(400, 2000, 800);
  assert.equal(geometry.size, 80);
  assert.equal(geometry.offset, 160);
  assert.equal(scrollFromThumb(geometry.offset, geometry), 800);
  assert.equal(scrollFromThumb(-100, geometry), 0);
  assert.equal(scrollFromThumb(1000, geometry), 1600);
  assert.equal(scrollGeometry(400, 2000, 5000).offset, 320);
});

test('tiny, empty and two-axis viewports have finite geometry and reachable edges', () => {
  for (const [viewport, content, track] of [[0, 0, 0], [10, 2000, 10], [300, 100, 300], [300, 3000, 286]]) {
    const geometry = scrollGeometry(viewport, content, 0, track);
    for (const value of Object.values(geometry)) assert.ok(Number.isFinite(value));
    assert.ok(geometry.size <= track);
    assert.ok(geometry.offset >= 0);
    if (geometry.travel > 0) assert.equal(scrollFromThumb(geometry.travel, geometry), geometry.maxScroll);
  }
  assert.equal(scrollGeometry(300, 30000, 0).size, 24);
});

test('Vue components compile without a project build and preserve native viewport events', () => {
  for (const path of ['src/components/scroll/ScrollArea.vue', 'src/editor/components/DocumentEditor.vue', 'src/markdown/components/MarkdownToc.vue', 'src/settings/components/SettingsPage.vue']) {
    const source = readFileSync(path, 'utf8');
    const { descriptor, errors } = parse(source, { filename: path });
    assert.deepEqual(errors, []);
    assert.doesNotThrow(() => compileScript(descriptor, { id: 'scroll-test', inlineTemplate: true }));
    for (const style of descriptor.styles) {
      const result = compileStyle({ source: style.content, filename: path, id: 'data-v-scroll-test', scoped: true, preprocessLang: 'scss' });
      assert.deepEqual(result.errors, []);
    }
  }
  const source = readFileSync('src/components/scroll/ScrollArea.vue', 'utf8');
  assert.match(source, /scrollbar-width: none/);
  assert.match(source, /&::-webkit-scrollbar \{ display: none; width: 0; height: 0; \}/);
  assert.match(source, /transition: opacity 450ms ease/);
  assert.match(source, /transition-duration: 300ms/);
  assert.doesNotMatch(source, /transition:\s*none/, 'explicitly requested scrollbar fades must not be disabled');
  assert.match(source, /emit\('scroll', event\)/);
  assert.match(source, /setPointerCapture/);
  assert.match(source, /resizeObserver\?\.disconnect/);
  assert.match(source, /background: transparent/);
});
