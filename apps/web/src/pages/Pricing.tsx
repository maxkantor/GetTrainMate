import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Container } from '@/components/layout/Container';
import { authService } from '@/services/authService';
import { profileService } from '@/services/profileService';
import { billingService, BillingPlanDto } from '@/services/billingService';
import { useAuthContext } from '@/hooks/useAuthContext';
import styles from '@/pages/Pricing.module.css';

const SELECTED_PLAN_KEY = 'selectedPlanKey';

/** Default plans for display when API fails (UI fallback) */
const DEFAULT_BILLING_PLANS: BillingPlanDto[] = [
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

const PLAN_ORDER = ['free', 'pro', 'elite'] as const;

export const PricingPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, user } = useAuthContext();
  const [plans, setPlans] = useState<BillingPlanDto[]>(DEFAULT_BILLING_PLANS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  useEffect(() => {
    billingService.getPlans().then((res) => {
      const arr = res?.plans ?? [];
      const merged =
        arr.length >= 3
          ? PLAN_ORDER.map((key) => {
              const dbPlan = arr.find((p: BillingPlanDto) => p.key === key);
              const def = DEFAULT_BILLING_PLANS.find((p) => p.key === key)!;
              return dbPlan
                ? { ...def, ...dbPlan, features: dbPlan.features?.length ? dbPlan.features : def.features }
                : def;
            })
          : DEFAULT_BILLING_PLANS;
      setPlans(merged);
    }).catch(() => setPlans(DEFAULT_BILLING_PLANS));
  }, []);

  useEffect(() => {
    const canceled = searchParams.get('canceled');
    if (canceled === '1') {
      setError('Checkout was canceled.');
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const startCheckout = useCallback(async (planKey: 'pro' | 'elite') => {
    setError(null);
    setLoadingPlan(planKey);
    try {
      const token = await authService.getJWT();
      if (!token) {
        localStorage.setItem(SELECTED_PLAN_KEY, planKey);
        window.location.href = `/signup?plan=${planKey}`;
        return;
      }
      const profile = await profileService.getMyProfile(token);
      if (!profile?.isComplete) {
        window.location.href = '/onboarding/profile';
        return;
      }
      const url = await billingService.createCheckoutSession(token, planKey);
      window.location.assign(url);
    } catch (err: unknown) {
      const res = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: string }; status?: number } }).response
        : null;
      const msg = res?.data?.error ?? (err instanceof Error ? err.message : 'Checkout failed');
      setError(typeof msg === 'string' ? msg : 'Checkout failed. Try again later.');
    } finally {
      setLoadingPlan(null);
    }
  }, []);

  useEffect(() => {
    const checkout = searchParams.get('checkout') as 'pro' | 'elite' | null;
    if ((checkout === 'pro' || checkout === 'elite') && isAuthenticated && user && !loadingPlan) {
      setSearchParams({}, { replace: true });
      startCheckout(checkout);
    }
  }, [searchParams, isAuthenticated, user, startCheckout, loadingPlan, setSearchParams]);

  const handleFree = () => {
    if (isAuthenticated && user) {
      window.location.href = '/app/discover';
    } else {
      window.location.href = '/signup';
    }
  };

  const handlePaid = (planKey: string) => {
    if (planKey !== 'pro' && planKey !== 'elite') return;
    if (!isAuthenticated || !user) {
      localStorage.setItem(SELECTED_PLAN_KEY, planKey);
      window.location.href = `/signup?plan=${planKey}`;
      return;
    }
    startCheckout(planKey as 'pro' | 'elite');
  };

  const sortedPlans = PLAN_ORDER
    .map((k) => plans.find((p) => p.key === k))
    .filter((p): p is BillingPlanDto => p != null);

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <Container>
          <h1 className={styles.title}>Find the Right Training Partner. Faster.</h1>
          <p className={styles.subtext}>
            Upgrade only when you want unlimited matches, AI compatibility, and priority placement.
          </p>
        </Container>
      </section>

      {error && (
        <div className={styles.errorBanner} role="alert">
          {error}
        </div>
      )}

      <section id="pricing-plans" className={styles.section}>
        <Container size="xl">
          {loading ? (
            <p className={styles.loading}>Loading plans…</p>
          ) : (
            <>
              <div className={styles.cards}>
                {sortedPlans.map((plan) => {
                  const isElite = plan.key === 'elite';
                  const isFree = plan.key === 'free';
                  const isPro = plan.key === 'pro';
                  const isLoading = loadingPlan === plan.key;
                  const ctaLabel = isPro ? 'Upgrade to Pro' : 'Go Elite';

                  return (
                    <div
                      key={plan.key}
                      className={`${styles.card} ${isPro ? styles.cardPro : ''} ${isElite ? styles.cardElite : ''}`}
                    >
                      {isElite && <span className={styles.badge}>Most Popular</span>}
                      <h3 className={styles.planName}>{plan.displayName}</h3>
                      <div className={styles.price}>
                        <span className={styles.currency}>$</span>
                        <span className={styles.amount}>{plan.monthlyPrice}</span>
                        <span className={styles.period}>/month</span>
                      </div>
                      <ul className={styles.features}>
                        {plan.features.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                      {isFree ? (
                        <button type="button" className={styles.btnSecondary} onClick={handleFree}>
                          Start Free
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={isElite ? styles.btnPrimary : styles.btnSecondary}
                          onClick={() => handlePaid(plan.key)}
                          disabled={!!loadingPlan}
                        >
                          {isLoading ? 'Redirecting…' : ctaLabel}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className={styles.trustRow}>
                <span className={styles.trustItem}>
                  <svg className={styles.trustIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  Cancel anytime
                </span>
                <span className={styles.trustItem}>
                  <svg className={styles.trustIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                  Secure payments
                </span>
                <span className={styles.trustItem}>
                  <svg className={styles.trustIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                  </svg>
                  Instant upgrade
                </span>
              </div>
            </>
          )}
        </Container>
      </section>
    </main>
  );
};
