export interface ContentScrollPosition {
  /** One-based source line, with a fractional offset within wrapped/block content. */
  line: number;
  edge?: 'start' | 'end';
}

export interface ScrollAnchor {
  line: number;
  top: number;
}

export interface SourceBlock {
  start: number;
  end: number;
  top: number;
  bottom: number;
}

/** Nested blocks can share lines. Starts win over ends at paragraph boundaries. */
export function createScrollAnchors(blocks: SourceBlock[], endLine: number, contentBottom: number): ScrollAnchor[] {
  const points = new Map<number, { top: number; start: boolean }>();
  points.set(1, { top: 0, start: false });
  for (const block of blocks) {
    if (![block.start, block.end, block.top, block.bottom].every(Number.isFinite)) continue;
    if (block.start < 1 || block.end <= block.start) continue;
    points.set(block.start, { top: Math.max(0, block.top), start: true });
    const end = points.get(block.end);
    if (!end?.start) points.set(block.end, { top: Math.max(end?.top ?? 0, block.bottom), start: false });
  }
  if (!points.has(endLine)) points.set(endLine, { top: contentBottom, start: false });
  const anchors: ScrollAnchor[] = [];
  let previousTop = 0;
  for (const [line, point] of [...points].sort(([a], [b]) => a - b)) {
    previousTop = Math.max(previousTop, point.top);
    anchors.push({ line, top: previousTop });
  }
  return anchors;
}

/** Piecewise interpolation only inside corresponding source blocks, never whole-document ratios. */
export function mapScrollPosition(anchors: ScrollAnchor[], value: number, from: 'line' | 'top'): number {
  const to = from === 'line' ? 'top' : 'line';
  if (!anchors.length) return from === 'line' ? 0 : 1;
  if (value <= anchors[0][from]) return anchors[0][to];
  let low = 0;
  let high = anchors.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (anchors[middle][from] <= value) low = middle + 1;
    else high = middle;
  }
  const before = anchors[low - 1];
  const after = anchors[low];
  if (!after) return before[to];
  const distance = after[from] - before[from];
  return before[to] + (distance > 0 ? (value - before[from]) / distance : 0) * (after[to] - before[to]);
}
