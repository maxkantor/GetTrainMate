/**
 * Default credit packs (fallback when API unavailable or DB empty).
 * Built from apps/web/src/config/pricingPlans.ts — keep in sync with server PricingPlanCatalog.
 */
import { PRICING_PLANS, type CreditPackKey } from '@/config/pricingPlans';

export type { CreditPackKey } from '@/config/pricingPlans';

export interface CreditPack {
  key: CreditPackKey;
  title: string;
  priceUsd: number;
  credits: number;
  sortOrder: number;
  isBestValue: boolean;
  isFree: boolean;
}

export const FALLBACK_CREDIT_PACKS: CreditPack[] = PRICING_PLANS.filter((p) => p.isVisible && p.isActive).map(
  (p) => ({
    key: p.key,
    title: p.name,
    priceUsd: p.priceUsd,
    credits: p.credits,
    sortOrder: p.sortOrder,
    isBestValue: p.isHighlighted,
    isFree: p.isFree,
  })
);

/**
 * Marketing features keyed by canonical pack key.
 */
export const CREDIT_PACK_FEATURES: Record<CreditPackKey, string[]> = {
  starter: [
    'Browse local training partners',
    'View profiles and explore matches',
    'Try the experience with starter credits',
    'Use basic discovery filters',
  ],
  go: [
    'Unlock chats with more matches',
    'Increase profile visibility',
    'Use AI compatibility insights',
    'Filter partners by distance and activity',
  ],
  best_value: [
    'Best balance of visibility and connections',
    'Unlock more chats faster',
    'Includes boosts and AI insights',
    'Reveal recent likes',
    'Ideal for active users',
  ],
  power: [
    'Maximum profile visibility',
    'More boosts and unlocked chats',
    'Advanced filters for better matches',
    'Priority placement in discovery',
    'Perfect for power users',
  ],
  elite: [
    'Best credit value for heavy use',
    'Built for the most active members',
    'More chat unlocks, boosts, and AI actions',
    'Great for sustained usage',
    'Best long-term flexibility',
  ],
};
