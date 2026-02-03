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
  { key: 'PACK_10', title: '10 Credits', priceUsd: 3.99, credits: 10, sortOrder: 2, isBestValue: false, isFree: false },
  { key: 'PACK_25', title: 'Best Value', priceUsd: 7.99, credits: 25, sortOrder: 3, isBestValue: true, isFree: false },
  { key: 'PACK_100', title: 'Power', priceUsd: 19.99, credits: 100, sortOrder: 4, isBestValue: false, isFree: false },
];

/**
 * Marketing features keyed by pack key.
 * Admin can tweak pricing/credits in the CRM without affecting copy.
 */
export const CREDIT_PACK_FEATURES: Record<CreditPackKey, string[]> = {
  FREE_3: [
    'Browse matches + view profiles',
    '3 credits to try the flow',
    'Try 1 chat unlock or 1 AI insight',
    'Basic filters',
  ],
  PACK_10: [
    'Unlock chat with up to 5 matches',
    '1 Boost (24h) to increase visibility',
    '1 AI insight (workout + compatibility)',
    'Location radius filters',
  ],
  PACK_25: [
    'Unlock chat with up to 15 matches',
    '3 Boosts (24h each) for visibility spikes',
    '3 AI insights (workout + compatibility)',
    'See who liked you (7 days)',
  ],
  PACK_100: [
    'Unlock chat with up to 60 matches',
    '10 Boosts (24h each)',
    'Priority placement (48h)',
    'See who liked you (30 days)',
    'Advanced filters (pace, goals, schedule)',
  ],
};
