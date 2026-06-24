/**
 * GetTrainMate mark — “Meetpoint”: three paths (Train · Vibe · Date) converge at one destination.
 * 48×48 viewBox — tuned for favicon through app icon.
 */
export type GtmMarkVariant = 'main' | 'favicon' | 'transparent' | 'navbar';

export const GTM_MARK_VIEWBOX = 48;

/** Unified meeting point — where paths converge */
export const MEETPOINT = { cx: 24, cy: 23.5, r: 6, coreR: 3.6 } as const;

/** TRAIN — path from top (momentum / growth) */
export const PATH_TRAIN = 'M24 6 C24 11.5 24 15.5 24 17.6';

/** VIBE — path from bottom-left (community) */
export const PATH_VIBE = 'M7.5 38.5 C11.2 31.5 15.8 26.2 19 24';

/** DATE — path from bottom-right (chemistry) */
export const PATH_DATE = 'M40.5 38.5 C36.8 31.5 32.2 26.2 29 24';

/** Unified journey after convergence */
export const PATH_FORWARD = 'M24 29.6 C24 33.2 24 36.2 24 39.2';

/** Hidden compass cross + T for TrainMate */
export const HIDDEN_GLYPH = 'M24 17.8v5.4M20.4 23.5h7.2';

export const ORIGIN_TRAIN = { cx: 24, cy: 6, r: 1.6 } as const;
export const ORIGIN_VIBE = { cx: 7.5, cy: 38.5, r: 1.6 } as const;
export const ORIGIN_DATE = { cx: 40.5, cy: 38.5, r: 1.6 } as const;

export function strokeWidthFor(variant: GtmMarkVariant): number {
  if (variant === 'favicon') return 3.75;
  if (variant === 'transparent' || variant === 'navbar') return 3.1;
  return 2.85;
}

export function meetRadius(variant: GtmMarkVariant): number {
  return variant === 'favicon' ? 6.8 : MEETPOINT.r;
}

export function showBackground(variant: GtmMarkVariant): boolean {
  return variant === 'main' || variant === 'favicon';
}

export function showForwardPath(variant: GtmMarkVariant): boolean {
  return variant !== 'favicon';
}

export function showHiddenGlyphs(variant: GtmMarkVariant): boolean {
  return variant === 'main' || variant === 'navbar';
}

export function showOriginMarks(variant: GtmMarkVariant): boolean {
  return variant === 'main';
}
