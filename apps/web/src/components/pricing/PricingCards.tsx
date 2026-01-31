import React from 'react';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';
import { pricingPlans } from '@/data/pricingData';
import styles from './PricingCards.module.css';

interface PricingCardsProps {
  isAnnual: boolean;
}

/* Display order: Free | Pro | Elite (Elite dominant, mobile: Elite first) */
const PLAN_ORDER: Array<'free' | 'pro' | 'elite'> = ['free', 'pro', 'elite'];

export const PricingCards: React.FC<PricingCardsProps> = ({ isAnnual }) => {
  const handleUpgrade = async (planId: string) => {
    try {
      const { authService } = await import('@/services/authService');
      const { profileService } = await import('@/services/profileService');

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
      } else {
        window.location.href = `/app/subscription?plan=${planId}&billing=${isAnnual ? 'annual' : 'monthly'}`;
      }
    } catch {
      window.location.href = '/signup';
    }
  };

  const orderedPlans = PLAN_ORDER.map((id) => pricingPlans.find((p) => p.id === id)!).filter(Boolean);

  return (
    <section id="pricing-plans" className={styles.cardsSection}>
      <Container size="xl">
        <div className={styles.cardsContainer}>
          {orderedPlans.map((plan) => {
            const monthlyPrice = plan.monthlyPrice;
            const yearlyPrice = plan.yearlyPrice;
            const yearlyEmphasized = isAnnual;
            const monthlyEmphasized = !isAnnual;
            const showSavings = yearlyEmphasized && plan.id !== 'free';

            return (
              <div
                key={plan.id}
                className={`${styles.card} ${plan.featured ? styles.featured : ''}`}
              >
                {plan.featured && (
                  <div className={styles.popularBadge}>Most Popular</div>
                )}

                <div className={styles.cardHeader}>
                  <h3 className={styles.planName}>{plan.name}</h3>
                  <p className={styles.planTagline}>{plan.tagline}</p>

                  <div className={styles.dualPrices}>
                    <div className={`${styles.priceRow} ${monthlyEmphasized ? styles.emphasized : ''}`}>
                      <span className={styles.currency}>$</span>
                      <span className={styles.price}>{monthlyPrice}</span>
                      <span className={styles.period}>/month</span>
                    </div>
                    <div className={`${styles.priceRow} ${yearlyEmphasized ? styles.emphasized : ''}`}>
                      {plan.id === 'free' ? (
                        <span className={styles.period}>$0/year</span>
                      ) : (
                        <>
                          <span className={styles.currency}>$</span>
                          <span className={styles.priceSmall}>{yearlyPrice}</span>
                          <span className={styles.period}>/year</span>
                          {showSavings && (
                            <span className={styles.saveBadge}>Save 17%</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <ul className={styles.features}>
                  {plan.features.map((feature, idx) => (
                    <li
                      key={idx}
                      className={`${styles.feature} ${!feature.included ? styles.greyed : ''}`}
                    >
                      <span
                        className={`${styles.checkIcon} ${
                          feature.included ? styles.included : styles.notIncluded
                        }`}
                      >
                        {feature.included ? '✓' : '—'}
                      </span>
                      <span>{feature.text}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={plan.featured ? 'primary' : 'secondary'}
                  size="lg"
                  fullWidth
                  onClick={() => handleUpgrade(plan.id)}
                  className={styles.ctaButton}
                >
                  {plan.id === 'free'
                    ? 'Start Free'
                    : yearlyEmphasized
                    ? 'Save with Annual'
                    : 'Start Monthly'}
                </Button>

                <p className={styles.trustLine}>Cancel anytime • Secure payments</p>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
};
