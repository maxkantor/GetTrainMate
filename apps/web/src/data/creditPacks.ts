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

/** Short outcome bullets for pricing cards (fallback; i18n overrides per locale). */
export const CREDIT_PACK_FEATURES: Record<CreditPackKey, string[]> = {
  starter: [
    'Explore matches near you',
    'View profiles & basic filters',
    'Try core app features',
    'Upgrade anytime for more',
  ],
  go: ['More matches faster', 'Boost profile visibility', 'Unlock chats instantly', 'AI-powered insights'],
  best_value: [
    'More matches faster',
    'Boost profile visibility',
    'Unlock chats instantly',
    'AI-powered insights',
    'Best value per credit',
  ],
  power: [
    'More matches faster',
    'Boost profile visibility',
    'Unlock chats instantly',
    'Advanced discovery & priority',
  ],
  elite: [
    'More matches faster',
    'Boost profile visibility',
    'Unlock chats instantly',
    'Lowest cost per credit',
  ],
};
