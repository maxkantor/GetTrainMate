/**
 * Default credit packs (fallback when API unavailable or DB empty).
 * Must match server fallback in GetTrainMate.Api.Constants.CreditPacksFallback.
 */
export interface CreditPack {
  key: string;
  title: string;
  priceUsd: number;
  credits: number;
  sortOrder: number;
  isBestValue: boolean;
  isActive?: boolean;
}

export const DEFAULT_CREDIT_PACKS: CreditPack[] = [
  { key: 'FREE_3', title: 'Starter', priceUsd: 0, credits: 3, sortOrder: 1, isBestValue: false },
  { key: 'PACK_10', title: '10 Credits', priceUsd: 3.99, credits: 10, sortOrder: 2, isBestValue: false },
  { key: 'PACK_25', title: 'Best Value', priceUsd: 7.99, credits: 25, sortOrder: 3, isBestValue: true },
  { key: 'PACK_100', title: 'Power', priceUsd: 19.99, credits: 100, sortOrder: 4, isBestValue: false },
];

/** Bullet points for what credits do (used on pricing cards). */
export const CREDIT_FEATURES = [
  'Unlock chat with matches',
  'Boost profile visibility',
  'AI workout insights',
];
