export interface ScrollGeometry {
  maxScroll: number;
  track: number;
  size: number;
  travel: number;
  offset: number;
}

export function clampScroll(value: number, max: number): number {
  return Math.max(0, Math.min(max, Number.isFinite(value) ? value : 0));
}

export function scrollGeometry(viewport: number, content: number, position: number, track = viewport): ScrollGeometry {
  const maxScroll = Math.max(0, content - viewport);
  track = Math.max(0, track);
  const size = maxScroll > 0 ? Math.min(track, Math.max(24, track * viewport / content)) : track;
  const travel = track - size;
  return { maxScroll, track, size, travel, offset: maxScroll > 0 ? clampScroll(position, maxScroll) / maxScroll * travel : 0 };
}

export function scrollFromThumb(offset: number, geometry: ScrollGeometry): number {
  return geometry.travel > 0 ? clampScroll(offset / geometry.travel * geometry.maxScroll, geometry.maxScroll) : 0;
}
