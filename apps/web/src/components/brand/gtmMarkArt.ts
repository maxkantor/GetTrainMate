/**
 * GetTrainMate brand mark — “T-Mark”
 * Bold custom lettermark (TrainMate / Tesla lineage). One filled silhouette.
 * Brand recognition first — not literal mode iconography.
 */
export type GtmMarkVariant = 'main' | 'favicon' | 'transparent' | 'navbar';

export const GTM_MARK_VIEWBOX = 48;

/** Custom T: arched crossbar + tapered stem — single closed path */
export const MARK_SILHOUETTE =
  'M 10 17 C 14 10.5, 34 10.5, 38 17 L 38 20 L 29.5 20 L 29.5 37.5 C 29.5 40.4, 27.1 42.5, 24 42.5 C 20.9 42.5, 18.5 40.4, 18.5 37.5 L 18.5 20 L 10 20 Z';

/** Bolder proportions for 16×16 rasterization */
export const MARK_SILHOUETTE_FAVICON =
  'M 9 17.5 C 13.5 10, 34.5 10, 39 17.5 L 39 21 L 30 21 L 30 38 C 30 41, 27.2 43, 24 43 C 20.8 43, 18 41, 18 38 L 18 21 L 9 21 Z';

export function markPath(variant: GtmMarkVariant): string {
  return variant === 'favicon' ? MARK_SILHOUETTE_FAVICON : MARK_SILHOUETTE;
}

export function showBackground(variant: GtmMarkVariant): boolean {
  return variant === 'main' || variant === 'favicon';
}
