/**
 * GetTrainMate — “TriMerge” mark
 * One continuous stroke: three entry paths converge, one exit (Connection).
 * Stroke-only (Bélo / Swoosh lineage) — no nodes, pins, droplets, or filled blobs.
 */
export type GtmMarkVariant = 'main' | 'favicon' | 'transparent' | 'navbar';

export const GTM_MARK_VIEWBOX = 48;

/** Train (top) · Vibe (left-low) · Date (left-high) → meet → Connection (right) */
export const MARK_STROKE =
  'M 6 34 C 14 32, 20 28, 24 26 C 18 20, 10 14, 6 12 C 16 18, 22 23, 24 26 C 24 10, 24 23, 24 26 C 32 26, 40 26, 44 24';

/** Fewer bends — clearer at 16×16 */
export const MARK_STROKE_FAVICON =
  'M 6 34 C 15 31, 21 28, 24 26 C 17 19, 9 13, 6 12 C 17 18, 23 24, 24 26 C 24 9, 24 24, 24 26 C 33 26, 41 25, 44 24';

export function markStrokePath(variant: GtmMarkVariant): string {
  return variant === 'favicon' ? MARK_STROKE_FAVICON : MARK_STROKE;
}

export function strokeWidthFor(variant: GtmMarkVariant): number {
  if (variant === 'favicon') return 4.25;
  if (variant === 'navbar' || variant === 'transparent') return 3.65;
  return 3.5;
}

export function showBackground(variant: GtmMarkVariant): boolean {
  return variant === 'main' || variant === 'favicon';
}
