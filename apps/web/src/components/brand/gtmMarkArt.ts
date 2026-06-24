/**
 * GetTrainMate brand mark — “Apex Confluence”
 * One continuous filled silhouette: three paths (Train · Vibe · Date) merge to a single apex (Connection).
 * No nodes, circles, figures, or network strokes.
 */
export type GtmMarkVariant = 'main' | 'favicon' | 'transparent' | 'navbar';

export const GTM_MARK_VIEWBOX = 48;

/**
 * Single closed path — trilobate base converging to top apex.
 * Optimized for bold silhouette at 16×16.
 */
export const MARK_SILHOUETTE =
  'M24 4.5 C31.2 8.8 40.5 19.5 39.8 29.5 C39.2 36.2 33.8 41.8 27.2 42.2 C25.4 42.3 24.6 39.8 24 37.8 C23.4 39.8 22.6 42.3 20.8 42.2 C14.2 41.8 8.8 36.2 8.2 29.5 C7.5 19.5 16.8 8.8 24 4.5 Z';

/** Slightly simplified for favicon rasterization */
export const MARK_SILHOUETTE_FAVICON =
  'M24 5 C31 9.5 40 20 39.5 30 C39 36.5 34 41.5 27.5 42 C25.5 42 24.5 39.5 24 38 C22.5 39.5 21.5 42 19.5 42 C13 41.5 8 36.5 8.5 30 C8 20 17 9.5 24 5 Z';

export function markPath(variant: GtmMarkVariant): string {
  return variant === 'favicon' ? MARK_SILHOUETTE_FAVICON : MARK_SILHOUETTE;
}

export function showBackground(variant: GtmMarkVariant): boolean {
  return variant === 'main' || variant === 'favicon';
}
