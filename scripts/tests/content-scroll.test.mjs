import assert from 'node:assert/strict';
import test from 'node:test';
import MarkdownIt from 'markdown-it';
import { createScrollAnchors, mapScrollPosition } from '../../src/editor/scroll/contentScroll.ts';
import { sourceLinesPlugin } from '../../src/markdown/plugins/sourceLines.ts';

test('source ranges cover headings, nested lists, table rows and custom diagram renderers', () => {
  const md = new MarkdownIt();
  md.renderer.rules.fence = () => '<div class="diagram"><svg></svg></div>';
  md.use(sourceLinesPlugin);
  const html = md.render('# Heading\n\n- One\n  - Nested\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n```mermaid\nA --> B\n```\n');
  assert.match(html, /<h1 data-source-line="1" data-source-end="2">/);
  assert.match(html, /<li data-source-line="4"/);
  assert.match(html, /<tr data-source-line="8" data-source-end="9">/);
  assert.match(html, /<div data-source-line="10" data-source-end="13" class="diagram">/);
  assert.doesNotMatch(html, /<[^>]*data-source-line[^>]*data-source-line/);
});

test('large rendered diagrams map by their source block, not document percentage', () => {
  const anchors = createScrollAnchors([
    { start: 1, end: 2, top: 28, bottom: 60 },
    { start: 3, end: 8, top: 100, bottom: 1600 },
    { start: 10, end: 20, top: 1650, bottom: 1850 }
  ], 21, 1930);
  assert.equal(mapScrollPosition(anchors, 5.5, 'line'), 850);
  assert.equal(mapScrollPosition(anchors, 850, 'top'), 5.5);
  assert.equal(mapScrollPosition(anchors, 10, 'line'), 1650);
  assert.equal(mapScrollPosition(anchors, 1650, 'top'), 10);
});

test('nested boundaries stay monotone, and next block starts override previous ends', () => {
  const anchors = createScrollAnchors([
    { start: 1, end: 8, top: 20, bottom: 400 },
    { start: 1, end: 4, top: 25, bottom: 150 },
    { start: 2, end: 3, top: 70, bottom: 95 },
    { start: 4, end: 8, top: 180, bottom: 390 },
    { start: 8, end: 9, top: 440, bottom: 465 }
  ], 10, 500);
  assert.equal(mapScrollPosition(anchors, 1, 'line'), 25);
  assert.equal(mapScrollPosition(anchors, 4, 'line'), 180);
  assert.equal(mapScrollPosition(anchors, 8, 'line'), 440);
  for (let i = 1; i < anchors.length; i++) {
    assert.ok(anchors[i].line > anchors[i - 1].line);
    assert.ok(anchors[i].top >= anchors[i - 1].top);
  }
});

test('remeasuring after image loading updates the corresponding content location', () => {
  const before = createScrollAnchors([{ start: 3, end: 4, top: 50, bottom: 70 }, { start: 6, end: 7, top: 100, bottom: 130 }], 8, 160);
  const after = createScrollAnchors([{ start: 3, end: 4, top: 50, bottom: 570 }, { start: 6, end: 7, top: 600, bottom: 630 }], 8, 660);
  assert.equal(mapScrollPosition(before, 6, 'line'), 100);
  assert.equal(mapScrollPosition(after, 6, 'line'), 600);
  assert.equal(mapScrollPosition(after, 600, 'top'), 6);
});

test('empty content, collapsed/duplicate positions and out-of-range values stay finite', () => {
  assert.equal(mapScrollPosition([], 0, 'top'), 1);
  assert.equal(mapScrollPosition([], 1, 'line'), 0);
  const anchors = createScrollAnchors([
    { start: 2, end: 3, top: 40, bottom: 40 },
    { start: 4, end: 5, top: 40, bottom: 80 }
  ], 6, 100);
  assert.equal(mapScrollPosition(anchors, -10, 'top'), 1);
  assert.equal(mapScrollPosition(anchors, 1000, 'line'), 100);
  assert.equal(mapScrollPosition(anchors, 40, 'top'), 4);
});
