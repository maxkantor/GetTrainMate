/**
 * GetTrainMate brand mark — Interlock Rings
 * Two overlapping rings: connection, partnership, continuity — not literal infinity.
 * Favicon geometry is tuned separately (larger fill, less padding).
 */
export type GtmMarkVariant =
  | 'main'
  | 'favicon'
  | 'transparent'
  | 'navbar'
  | 'app'
  | 'monochrome'
  | 'dark';

export const GTM_MARK_VIEWBOX = 48;

export type RingSpec = {
  cx: number;
  cy: number;
  outerR: number;
  innerR: number;
};

/** Navbar / app / transparent — balanced overlap with subtle vertical flow */
const STANDARD_RINGS: RingSpec[] = [
  { cx: 18.8, cy: 23.55, outerR: 11.25, innerR: 6.35 },
  { cx: 29.2, cy: 24.45, outerR: 11.25, innerR: 6.35 },
];

/** Favicon — ~18% thicker band, rings scaled to fill canvas */
const FAVICON_RINGS: RingSpec[] = [
  { cx: 16.55, cy: 23.35, outerR: 13.15, innerR: 7.05 },
  { cx: 31.45, cy: 24.65, outerR: 13.15, innerR: 7.05 },
];

export function getRings(variant: GtmMarkVariant): RingSpec[] {
  return variant === 'favicon' ? FAVICON_RINGS : STANDARD_RINGS;
}

/** Donut ring as even-odd compound path — crisp at 16×16 */
export function ringDonutPath(ring: RingSpec): string {
  const { cx, cy, outerR, innerR } = ring;
  return [
    `M ${cx + outerR} ${cy}`,
    `A ${outerR} ${outerR} 0 1 1 ${cx - outerR} ${cy}`,
    `A ${outerR} ${outerR} 0 1 1 ${cx + outerR} ${cy}`,
    `Z`,
    `M ${cx + innerR} ${cy}`,
    `A ${innerR} ${innerR} 0 1 0 ${cx - innerR} ${cy}`,
    `A ${innerR} ${innerR} 0 1 0 ${cx + innerR} ${cy}`,
    `Z`,
  ].join(' ');
}

export function showBackground(variant: GtmMarkVariant): boolean {
  return variant === 'main' || variant === 'favicon' || variant === 'app' || variant === 'dark';
}

export function backgroundFill(variant: GtmMarkVariant): string {
  return variant === 'dark' ? '#070B1A' : '#0B1020';
}

export function backgroundRadius(variant: GtmMarkVariant): number {
  return variant === 'app' ? 12 : 11;
}

export function isMonochrome(variant: GtmMarkVariant): boolean {
  return variant === 'monochrome';
}

export const BRAND_GRADIENT = {
  start: '#7C5CFF',
  mid: '#C084FC',
  accent: '#FFB347',
} as const;

export const DARK_GRADIENT = {
  start: '#9B7FFF',
  mid: '#D8B4FE',
  accent: '#FFCC80',
} as const;
