/**
 * Canonical pricing catalog — keep in sync with GetTrainMate.Api.Constants.PricingPlanCatalog (C#).
 */

export const CANONICAL_PACK_KEYS = ['starter', 'go', 'best_value', 'power', 'elite'] as const;

export type CreditPackKey = (typeof CANONICAL_PACK_KEYS)[number];

export type LegacyPackKey = 'FREE_3' | 'PACK_10' | 'PACK_25' | 'PACK_100';

const LEGACY_TO_CANONICAL: Record<LegacyPackKey, CreditPackKey> = {
  FREE_3: 'starter',
  PACK_10: 'go',
  PACK_25: 'best_value',
  PACK_100: 'power',
};

export interface PricingPlanDefinition {
  key: CreditPackKey;
  name: string;
  priceUsd: number;
  credits: number;
  isFree: boolean;
  isHighlighted: boolean;
  sortOrder: number;
  isVisible: boolean;
  isActive: boolean;
}

export const PRICING_PLANS: readonly PricingPlanDefinition[] = [
  {
    key: 'starter',
    name: 'Starter',
    priceUsd: 0,
    credits: 3,
    isFree: true,
    isHighlighted: false,
    sortOrder: 1,
    isVisible: true,
    isActive: true,
  },
  {
    key: 'go',
    name: 'Go',
    priceUsd: 2.99,
    credits: 10,
    isFree: false,
    isHighlighted: false,
    sortOrder: 2,
    isVisible: true,
    isActive: true,
  },
  {
    key: 'best_value',
    name: 'Best Value',
    priceUsd: 6.99,
    credits: 30,
    isFree: false,
    isHighlighted: true,
    sortOrder: 3,
    isVisible: true,
    isActive: true,
  },
  {
    key: 'power',
    name: 'Power',
    priceUsd: 14.99,
    credits: 80,
    isFree: false,
    isHighlighted: false,
    sortOrder: 4,
    isVisible: true,
    isActive: true,
  },
  {
    key: 'elite',
    name: 'Elite',
    priceUsd: 29.99,
    credits: 200,
    isFree: false,
    isHighlighted: false,
    sortOrder: 5,
    isVisible: true,
    isActive: true,
  },
];

/** Map API or legacy keys to canonical keys for display and checkout. */
export function normalizeCreditPackKey(key: string): CreditPackKey | null {
  const k = key.trim() as LegacyPackKey | CreditPackKey;
  if (k in LEGACY_TO_CANONICAL) return LEGACY_TO_CANONICAL[k as LegacyPackKey];
  if ((CANONICAL_PACK_KEYS as readonly string[]).includes(k)) return k as CreditPackKey;
  return null;
}

export function isCanonicalPackKey(key: string): key is CreditPackKey {
  return (CANONICAL_PACK_KEYS as readonly string[]).includes(key);
}
