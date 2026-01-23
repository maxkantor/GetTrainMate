export interface PricingPlan {
  id: 'free' | 'pro' | 'elite';
  name: string;
  tagline: string;
  monthlyPrice: number;
  yearlyPrice: number;
  featured?: boolean;
  features: {
    text: string;
    included: boolean;
  }[];
  cta: string;
}

export const pricingPlans: PricingPlan[] = [
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Best for serious athletes',
    monthlyPrice: 9.99,
    yearlyPrice: 99,
    features: [
      { text: 'Unlimited matches per day', included: true },
      { text: 'Unlimited messaging', included: true },
      { text: 'Advanced filters', included: true },
      { text: 'AI compatibility scoring', included: true },
      { text: 'See who liked you', included: true },
      { text: 'Verified athlete badge', included: true },
      { text: 'Priority placement', included: false },
      { text: 'Weekly partner recommendations', included: false },
      { text: 'Profile spotlight', included: false },
    ],
    cta: 'Upgrade to Pro',
  },
  {
    id: 'elite',
    name: 'Elite',
    tagline: 'Maximum visibility & features',
    monthlyPrice: 24.99,
    yearlyPrice: 249,
    featured: true,
    features: [
      { text: 'Unlimited matches per day', included: true },
      { text: 'Unlimited messaging', included: true },
      { text: 'Advanced filters', included: true },
      { text: 'AI compatibility scoring', included: true },
      { text: 'See who liked you', included: true },
      { text: 'Verified athlete badge', included: true },
      { text: 'Priority placement', included: true },
      { text: 'Weekly partner recommendations', included: true },
      { text: 'Profile spotlight', included: true },
    ],
    cta: 'Go Elite',
  },
  {
    id: 'free',
    name: 'Free',
    tagline: 'Perfect to get started',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      { text: '10 matches per day', included: true },
      { text: '5 messages per day', included: true },
      { text: 'Basic filters', included: true },
      { text: 'AI compatibility scoring', included: false },
      { text: 'See who liked you', included: false },
      { text: 'Verified athlete badge', included: false },
      { text: 'Priority placement', included: false },
      { text: 'Weekly partner recommendations', included: false },
      { text: 'Profile spotlight', included: false },
    ],
    cta: 'Get Started',
  },
];

export interface ComparisonFeature {
  name: string;
  free: string | boolean;
  pro: string | boolean;
  elite: string | boolean;
}

export const comparisonFeatures: ComparisonFeature[] = [
  { name: 'Matches per day', free: '10', pro: 'Unlimited', elite: 'Unlimited' },
  { name: 'Messages per day', free: '5', pro: 'Unlimited', elite: 'Unlimited' },
  { name: 'Advanced filters', free: false, pro: true, elite: true },
  { name: 'AI compatibility scoring', free: false, pro: true, elite: true },
  { name: 'See who liked you', free: false, pro: true, elite: true },
  { name: 'Verified athlete badge', free: false, pro: true, elite: true },
  { name: 'Priority placement', free: false, pro: false, elite: true },
  { name: 'Weekly partner recommendations', free: false, pro: false, elite: true },
  { name: 'Profile spotlight', free: false, pro: false, elite: true },
  { name: 'Event creation', free: '2/month', pro: 'Unlimited', elite: 'Unlimited' },
];

export interface PricingFAQ {
  question: string;
  answer: string;
}

export const pricingFAQs: PricingFAQ[] = [
  {
    question: 'Can I cancel my subscription at any time?',
    answer: 'Yes! You can cancel anytime from your account settings. Your premium features will remain active until the end of your billing period.',
  },
  {
    question: 'What happens to my matches if I downgrade?',
    answer: 'Your existing matches and conversations remain intact. You\'ll just be subject to the free tier limits (10 matches/day, 5 messages/day) going forward.',
  },
  {
    question: 'Is there a free trial for Pro or Elite?',
    answer: 'We offer a robust free tier so you can experience GetTrainMate risk-free. Once you\'re ready to upgrade, you can choose Pro or Elite without a trial period.',
  },
  {
    question: 'How do boosts work?',
    answer: 'Boosts place your profile at the top of the match feed for 30 minutes, increasing visibility. Available as one-time purchases for all users, or included with Elite tier.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards (Visa, Mastercard, Amex, Discover) processed securely through Stripe.',
  },
  {
    question: 'Will my data be shared with partners or sponsors?',
    answer: 'Never. Your personal data remains private. Sponsored challenges and affiliate links are clearly marked and entirely optional.',
  },
  {
    question: 'Do annual plans auto-renew?',
    answer: 'Yes, annual subscriptions renew automatically at the annual rate. You\'ll receive a reminder email before renewal and can cancel anytime.',
  },
  {
    question: 'Can I switch between Pro and Elite plans?',
    answer: 'Absolutely! You can upgrade or downgrade at any time. Changes take effect immediately, and we\'ll prorate the difference.',
  },
];
