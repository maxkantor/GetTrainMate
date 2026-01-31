export interface PricingPlan {
  id: 'free' | 'pro' | 'elite';
  name: string;
  tagline: string;
  monthlyPrice: number;
  featured?: boolean;
  features: { text: string; included: boolean }[];
  cta: string;
}

/** Minimal 3-plan structure: Free | Pro | Elite. Monthly only. */
export const pricingPlans: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Get started',
    monthlyPrice: 0,
    features: [
      { text: '10 matches per day', included: true },
      { text: '5 messages per day', included: true },
      { text: 'Basic filters', included: true },
      { text: 'AI compatibility', included: false },
      { text: 'See who liked you', included: false },
      { text: 'Priority placement', included: false },
    ],
    cta: 'Start Free',
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Serious athletes',
    monthlyPrice: 5.99,
    features: [
      { text: 'Unlimited matches', included: true },
      { text: 'Unlimited messaging', included: true },
      { text: 'Advanced filters', included: true },
      { text: 'AI compatibility', included: true },
      { text: 'See who liked you', included: true },
      { text: 'Priority placement', included: false },
    ],
    cta: 'Upgrade to Pro',
  },
  {
    id: 'elite',
    name: 'Elite',
    tagline: 'Maximum visibility',
    monthlyPrice: 9.99,
    featured: true,
    features: [
      { text: 'Unlimited matches', included: true },
      { text: 'Unlimited messaging', included: true },
      { text: 'Advanced filters', included: true },
      { text: 'AI compatibility', included: true },
      { text: 'See who liked you', included: true },
      { text: 'Priority placement', included: true },
    ],
    cta: 'Go Elite',
  },
];
