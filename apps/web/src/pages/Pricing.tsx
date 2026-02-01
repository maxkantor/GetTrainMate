import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Container } from '@/components/layout/Container';
import { authService } from '@/services/authService';
import { profileService } from '@/services/profileService';
import { billingService, BillingPlanDto } from '@/services/billingService';
import styles from '@/pages/Pricing.module.css';

/**
 * Pricing page: header, 3 cards from API, footer line.
 * No duplicate CTAs. One button per card only.
 */
export const PricingPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [plans, setPlans] = useState<BillingPlanDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  useEffect(() => {
    billingService.getPlans().then(setPlans).catch((e) => {
      setError(e.response?.data?.error ?? e.message ?? 'Failed to load plans');
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const canceled = searchParams.get('canceled');
    if (canceled === '1') {
      setError('Checkout was canceled.');
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleFree = () => {
    window.location.href = '/signup';
  };

  const handlePaid = async (planKey: string) => {
    setError(null);
    try {
      const token = await authService.getJWT();
      if (!token) {
        window.location.href = '/signup';
        return;
      }
      const profile = await profileService.getMyProfile(token);
      if (!profile?.isComplete) {
        window.location.href = '/onboarding/profile';
        return;
      }
      setLoadingPlan(planKey);
      const url = await billingService.createCheckoutSession(token, planKey as 'pro' | 'elite');
      window.location.href = url;
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : err instanceof Error ? err.message : 'Checkout failed';
      setError(msg ?? 'Checkout failed. Try again or contact support.');
      setLoadingPlan(null);
    }
  };

  const order = ['free', 'pro', 'elite'];
  const sortedPlans = order
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
          ) : sortedPlans.length === 0 ? (
            <p className={styles.loading}>No plans available.</p>
          ) : (
            <div className={styles.cards}>
              {sortedPlans.map((plan) => {
                const isElite = plan.key === 'elite';
                const isFree = plan.key === 'free';
                const isPaidUnavailable = !isFree && !plan.isConfigured;
                const isLoading = loadingPlan === plan.key;

                return (
                  <div
                    key={plan.key}
                    className={`${styles.card} ${isElite ? styles.featured : ''}`}
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
                        <li key={i}>✓ {f}</li>
                      ))}
                    </ul>
                    {isFree && (
                      <button type="button" className={styles.btnSecondary} onClick={handleFree}>
                        Start Free
                      </button>
                    )}
                    {!isFree && isPaidUnavailable && (
                      <button type="button" className={styles.btnSecondary} disabled>
                        Temporarily unavailable
                      </button>
                    )}
                    {!isFree && !isPaidUnavailable && (
                      <button
                        type="button"
                        className={isElite ? styles.btnPrimary : styles.btnSecondary}
                        onClick={() => handlePaid(plan.key)}
                        disabled={!!loadingPlan}
                      >
                        {isLoading ? 'Redirecting…' : plan.key === 'pro' ? 'Upgrade to Pro' : 'Go Elite'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Container>
      </section>

      <p className={styles.trustLine}>Cancel anytime. Secure payments.</p>
    </main>
  );
};
