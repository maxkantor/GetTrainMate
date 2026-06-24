/**
 * GetTrainMate mark — three connected nodes (Train · Vibe · Date).
 * Geometry is fixed in a 48×48 viewBox for favicon + navbar scaling.
 */
export type GtmMarkVariant = 'main' | 'favicon' | 'transparent' | 'navbar';

export const GTM_MARK_VIEWBOX = 48;

/** TRAIN — top */
export const NODE_TRAIN = { cx: 24, cy: 11.5, r: 5.2 } as const;
/** VIBE — bottom left */
export const NODE_VIBE = { cx: 10.5, cy: 35, r: 4.8 } as const;
/** DATE — bottom right */
export const NODE_DATE = { cx: 37.5, cy: 35, r: 4.8 } as const;

/** Flowing connection paths (triangle + journey loop) */
export const PATH_TRAIN_VIBE = 'M24 16.2 C20.5 21.5 14.5 28.5 11.8 32.2';
export const PATH_VIBE_DATE = 'M11.8 32.2 C19.5 37.8 28.5 37.8 36.2 32.2';
export const PATH_DATE_TRAIN = 'M36.2 32.2 C33 25.5 28 19.5 24 16.2';

/** Subtle hidden “T” in negative space */
export const HIDDEN_T = 'M24 18.5v7.2M20.2 24h7.6';

export function strokeWidthFor(variant: GtmMarkVariant): number {
  if (variant === 'favicon') return 3.4;
  if (variant === 'transparent' || variant === 'navbar') return 2.9;
  return 2.65;
}

export function showBackground(variant: GtmMarkVariant): boolean {
  return variant === 'main' || variant === 'favicon';
}

export function showHiddenDetails(variant: GtmMarkVariant): boolean {
  return variant === 'main' || variant === 'navbar';
}

export function showNodeRings(variant: GtmMarkVariant): boolean {
  return variant !== 'favicon';
}
