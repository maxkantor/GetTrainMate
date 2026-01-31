import React, { useState } from 'react';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';
import { pricingPlans } from '@/data/pricingData';
import { authService } from '@/services/authService';
import { profileService } from '@/services/profileService';
import { paymentService } from '@/services/paymentService';
import styles from './PricingCards.module.css';

/* Order: Elite first on mobile, Free | Pro | Elite on desktop */
const MOBILE_ORDER = ['elite', 'free', 'pro'];
const DESKTOP_ORDER: Array<'free' | 'pro' | 'elite'> = ['free', 'pro', 'elite'];

export const PricingCards: React.FC = () => {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleCta = async (planId: string) => {
    try {
      const token = await authService.getJWT();
      if (!token) {
        window.location.href = '/signup';
        return;
      }
      try {
        const profile = await profileService.getMyProfile(token);
        if (!profile.isComplete) {
          window.location.href = '/onboarding/profile';
          return;
        }
      } catch {
        window.location.href = '/onboarding/profile';
        return;
      }
      if (planId === 'free') {
        window.location.href = '/app/discover';
        return;
      }
      setLoadingPlan(planId);
      const { checkoutUrl } = await paymentService.createCheckoutSession(
        token,
        planId as 'pro' | 'elite'
      );
      window.location.href = checkoutUrl;
    } catch (err) {
      console.error('Checkout error:', err);
      setLoadingPlan(null);
      window.location.href = '/app/subscription?error=checkout_failed';
    }
  };

  const plansById = Object.fromEntries(pricingPlans.map((p) => [p.id, p]));

  return (
    <section id="pricing-plans" className={styles.section}>
      <Container size="xl">
        <div className={styles.cards}>
          {DESKTOP_ORDER.map((id, idx) => {
            const plan = plansById[id];
            if (!plan) return null;
            return (
              <div
                key={plan.id}
                className={`${styles.card} ${plan.featured ? styles.featured : ''}`}
                style={{ '--mobile-order': MOBILE_ORDER.indexOf(id) } as React.CSSProperties}
              >
                {plan.featured && <span className={styles.badge}>Most Popular</span>}
                <h3 className={styles.planName}>{plan.name}</h3>
                <p className={styles.tagline}>{plan.tagline}</p>
                <div className={styles.price}>
                  <span className={styles.currency}>$</span>
                  <span className={styles.amount}>{plan.monthlyPrice}</span>
                  <span className={styles.period}>/month</span>
                </div>
                <ul className={styles.features}>
                  {plan.features.map((f, i) => (
                    <li key={i} className={f.included ? '' : styles.greyed}>
                      <span className={f.included ? styles.check : styles.dash}>
                        {f.included ? '✓' : '—'}
                      </span>
                      {f.text}
                    </li>
                  ))}
                </ul>
                {plan.id === 'free' && (
                  <Button
                    variant="secondary"
                    size="lg"
                    fullWidth
                    onClick={() => handleCta('free')}
                  >
                    Start Free
                  </Button>
                )}
                {plan.id === 'pro' && (
                  <Button
                    variant="secondary"
                    size="lg"
                    fullWidth
                    onClick={() => handleCta('pro')}
                    disabled={loadingPlan !== null}
                  >
                    {loadingPlan === 'pro' ? 'Redirecting…' : 'Upgrade to Pro'}
                  </Button>
                )}
                {plan.id === 'elite' && (
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={() => handleCta('elite')}
                    disabled={loadingPlan !== null}
                  >
                    {loadingPlan === 'elite' ? 'Redirecting…' : 'Go Elite'}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
};
