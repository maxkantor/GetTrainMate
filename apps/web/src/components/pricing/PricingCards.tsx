import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Container } from '@/components/layout/Container';
import { authService } from '@/services/authService';
import { profileService } from '@/services/profileService';
import { paymentService } from '@/services/paymentService';
import styles from './PricingCards.module.css';

/* Order: Elite first on mobile, Free | Pro | Elite on desktop.
 * Buttons use native elements with explicit text - no abstraction, no empty labels. */
const MOBILE_ORDER = ['elite', 'free', 'pro'];
const DESKTOP_ORDER: Array<'free' | 'pro' | 'elite'> = ['free', 'pro', 'elite'];

const PLANS = [
  { id: 'free' as const, name: 'Free', price: 0, featured: false },
  { id: 'pro' as const, name: 'Pro', price: 5.99, featured: false },
  { id: 'elite' as const, name: 'Elite', price: 9.99, featured: true },
];

export const PricingCards: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canceled = searchParams.get('canceled');
    const err = searchParams.get('error');
    if (canceled === '1') {
      setError('Checkout was canceled.');
      setSearchParams({}, { replace: true });
    } else if (err) {
      setError(err === 'checkout_failed' ? 'Checkout failed. Please try again.' : decodeURIComponent(err));
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFree = () => {
    window.location.href = '/signup';
  };

  const handlePro = async () => {
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
      setLoadingPlan('pro');
      const url = await paymentService.createCheckoutSessionAndGetUrl(token, 'pro');
      if (!url) throw new Error('No checkout URL returned');
      window.location.href = url;
    } catch (err) {
      console.error('[Pricing] Pro checkout error:', err);
      setLoadingPlan(null);
      setError(err instanceof Error ? err.message : 'Checkout failed. Try again or contact support.');
    }
  };

  const handleElite = async () => {
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
      setLoadingPlan('elite');
      const url = await paymentService.createCheckoutSessionAndGetUrl(token, 'elite');
      if (!url) throw new Error('No checkout URL returned');
      window.location.href = url;
    } catch (err) {
      console.error('[Pricing] Elite checkout error:', err);
      setLoadingPlan(null);
      setError(err instanceof Error ? err.message : 'Checkout failed. Try again or contact support.');
    }
  };

  return (
    <section id="pricing-plans" className={styles.section}>
      {error && (
        <div className={styles.errorBanner} role="alert">
          {error}
        </div>
      )}
      <Container size="xl">
        <div className={styles.cards}>
          {DESKTOP_ORDER.map((id) => {
            const plan = PLANS.find((p) => p.id === id);
            if (!plan) return null;
            const isLoading = loadingPlan === plan.id;
            return (
              <div
                key={plan.id}
                className={`${styles.card} ${plan.featured ? styles.featured : ''}`}
                style={{ '--mobile-order': MOBILE_ORDER.indexOf(id) } as React.CSSProperties}
              >
                {plan.featured && <span className={styles.badge}>Most Popular</span>}
                <h3 className={styles.planName}>{plan.name}</h3>
                <p className={styles.tagline}>
                  {plan.id === 'free' && 'Get started'}
                  {plan.id === 'pro' && 'Serious athletes'}
                  {plan.id === 'elite' && 'Maximum visibility'}
                </p>
                <div className={styles.price}>
                  <span className={styles.currency}>$</span>
                  <span className={styles.amount}>{plan.price}</span>
                  <span className={styles.period}>/month</span>
                </div>
                <ul className={styles.features}>
                  {plan.id === 'free' && (
                    <>
                      <li>✓ 10 matches per day</li>
                      <li>✓ 5 messages per day</li>
                      <li>✓ Basic filters</li>
                      <li className={styles.greyed}>— AI compatibility</li>
                      <li className={styles.greyed}>— See who liked you</li>
                      <li className={styles.greyed}>— Priority placement</li>
                    </>
                  )}
                  {plan.id === 'pro' && (
                    <>
                      <li>✓ Unlimited matches</li>
                      <li>✓ Unlimited messaging</li>
                      <li>✓ Advanced filters</li>
                      <li>✓ AI compatibility</li>
                      <li>✓ See who liked you</li>
                      <li className={styles.greyed}>— Priority placement</li>
                    </>
                  )}
                  {plan.id === 'elite' && (
                    <>
                      <li>✓ Unlimited matches</li>
                      <li>✓ Unlimited messaging</li>
                      <li>✓ Advanced filters</li>
                      <li>✓ AI compatibility</li>
                      <li>✓ See who liked you</li>
                      <li>✓ Priority placement</li>
                    </>
                  )}
                </ul>
                {plan.id === 'free' && (
                  <button type="button" className={styles.btnSecondary} onClick={handleFree}>
                    Start Free
                  </button>
                )}
                {plan.id === 'pro' && (
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={handlePro}
                    disabled={!!loadingPlan}
                  >
                    {isLoading ? 'Redirecting…' : 'Upgrade to Pro'}
                  </button>
                )}
                {plan.id === 'elite' && (
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={handleElite}
                    disabled={!!loadingPlan}
                  >
                    {isLoading ? 'Redirecting…' : 'Go Elite'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
};
