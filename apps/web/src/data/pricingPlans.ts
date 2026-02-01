/** Default pricing plans (fallback when API unavailable or DB empty) */
export interface PricingPlan {
  key: string;
  displayName: string;
  monthlyPrice: number;
  features: string[];
  isConfigured: boolean;
}

export const DEFAULT_PRICING_PLANS: PricingPlan[] = [
  {
    key: 'free',
    displayName: 'Free',
    monthlyPrice: 0,
    features: ['10 matches per day', '5 messages per day', 'Basic filters'],
    isConfigured: true,
  },
  {
    key: 'pro',
    displayName: 'Pro',
    monthlyPrice: 5.99,
    features: ['Unlimited matches', 'Unlimited messaging', 'Advanced filters', 'AI compatibility', 'See who liked you'],
    isConfigured: false,
  },
  {
    key: 'elite',
    displayName: 'Elite',
    monthlyPrice: 9.99,
    features: ['Unlimited matches', 'Unlimited messaging', 'Advanced filters', 'AI compatibility', 'See who liked you', 'Priority placement'],
    isConfigured: false,
  },
];
