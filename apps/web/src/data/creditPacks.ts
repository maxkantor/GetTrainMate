/**
 * Default credit packs (fallback when API unavailable or DB empty).
 * Must stay in sync with server fallback in GetTrainMate.Api.Constants.CreditPacksFallback.
 */
export type CreditPackKey = 'FREE_3' | 'PACK_10' | 'PACK_25' | 'PACK_100';

export interface CreditPack {
  key: CreditPackKey;
  title: string;
  priceUsd: number;
  credits: number;
  sortOrder: number;
  isBestValue: boolean;
  isFree: boolean;
}

export const FALLBACK_CREDIT_PACKS: CreditPack[] = [
  { key: 'FREE_3', title: 'Starter', priceUsd: 0, credits: 3, sortOrder: 1, isBestValue: false, isFree: true },
  { key: 'PACK_10', title: 'Go', priceUsd: 3.99, credits: 10, sortOrder: 2, isBestValue: false, isFree: false },
  { key: 'PACK_25', title: 'Best Value', priceUsd: 7.99, credits: 25, sortOrder: 3, isBestValue: true, isFree: false },
  { key: 'PACK_100', title: 'Power', priceUsd: 19.99, credits: 100, sortOrder: 4, isBestValue: false, isFree: false },
];

/**
 * Marketing features keyed by pack key.
 * Admin can tweak pricing/credits in the CRM without affecting copy.
 */
export const CREDIT_PACK_FEATURES: Record<CreditPackKey, string[]> = {
  FREE_3: [
    'Browse local training partners',
    'View profiles and explore matches',
    'Try the experience with starter credits',
    'Use basic discovery filters',
  ],
  PACK_10: [
    'Unlock chats with more matches',
    'Increase profile visibility',
    'Use AI compatibility insights',
    'Filter partners by distance and activity',
  ],
  PACK_25: [
    'Best balance of visibility and connections',
    'Unlock more chats faster',
    'Includes boosts and AI insights',
    'Reveal recent likes',
    'Ideal for active users',
  ],
  PACK_100: [
    'Maximum profile visibility',
    'More boosts and unlocked chats',
    'Advanced filters for better matches',
    'Priority placement in discovery',
    'Perfect for power users',
  ],
};
