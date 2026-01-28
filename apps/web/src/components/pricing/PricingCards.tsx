import React from 'react';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';
import { pricingPlans } from '@/data/pricingData';
import { IMAGE_BUCKET_BASE } from '@/config/media';
import styles from './PricingCards.module.css';

interface PricingCardsProps {
  isAnnual: boolean;
}

const sidePanels = [
  {
    kicker: 'Community',
    title: 'Real training partners',
    subtitle: 'Verified athletes near you for focused sessions.',
    image: `${IMAGE_BUCKET_BASE}/pricing/vibe/strength.jpg`,
    alt: 'Athlete preparing for a workout',
    width: 800,
    height: 1000,
  },
  {
    kicker: 'Consistency',
    title: 'Motivation + accountability',
    subtitle: 'Streaks, reminders, and boosts to keep you on track.',
    image: `${IMAGE_BUCKET_BASE}/pricing/vibe/gym.jpg`,
    alt: 'Athletes training together',
    width: 800,
    height: 1000,
  },
];

export const PricingCards: React.FC<PricingCardsProps> = ({ isAnnual }) => {
  const handleUpgrade = async (planId: string) => {
    // Check if user is authenticated and has completed profile
    try {
      const { authService } = await import('@/services/authService');
      const { profileService } = await import('@/services/profileService');
      
      const token = await authService.getJWT();
      if (!token) {
        // Not authenticated - redirect to signup
        window.location.href = '/signup';
        return;
      }

      // Check profile completion
      try {
        const profile = await profileService.getMyProfile(token);
        if (!profile.isComplete) {
          // Profile incomplete - redirect to onboarding
          window.location.href = '/onboarding/profile';
          return;
        }
      } catch (err) {
        // Profile doesn't exist or error - redirect to onboarding
        window.location.href = '/onboarding/profile';
        return;
      }

      // Profile complete - proceed to checkout
      if (planId === 'free') {
        window.location.href = '/app/discover';
      } else {
        // TODO: Open Stripe checkout modal or redirect to subscription page
        window.location.href = `/app/subscription?plan=${planId}&billing=${isAnnual ? 'annual' : 'monthly'}`;
      }
    } catch (err) {
      console.error('Error checking profile:', err);
      // On error, redirect to signup
      window.location.href = '/signup';
    }
  };

  return (
    <section id="pricing-plans" className={styles.cardsSection}>
      <Container size="xl">
        <div className={styles.cardsLayout}>
          <aside className={styles.sidePanel} aria-hidden="true">
            <div className={styles.panelImageFrame}>
              <img
                src={sidePanels[0].image}
                alt={sidePanels[0].alt}
                width={sidePanels[0].width}
                height={sidePanels[0].height}
                loading="lazy"
                decoding="async"
                className={styles.panelImage}
              />
            </div>
            <div className={styles.panelCopy}>
              <span className={styles.panelKicker}>{sidePanels[0].kicker}</span>
              <p className={styles.panelTitle}>{sidePanels[0].title}</p>
              <p className={styles.panelSubtitle}>{sidePanels[0].subtitle}</p>
            </div>
          </aside>

          <div className={styles.cardsContainer}>
            {pricingPlans.map((plan) => {
              const monthlyPrice = plan.monthlyPrice;
              const yearlyPrice = plan.yearlyPrice;
              const monthlyEmphasized = !isAnnual;
              const yearlyEmphasized = isAnnual;
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

                    {/* Dual price display */}
                    <div className={styles.dualPrices}>
                      <div className={`${styles.priceRow} ${monthlyEmphasized ? styles.emphasized : ''}`}>
                        <span className={styles.currency}>$</span>
                        <span className={styles.price}>{monthlyPrice}</span>
                        <span className={styles.period}>/month</span>
                      </div>
                      <div className={`${styles.priceRow} ${yearlyEmphasized ? styles.emphasized : ''}`}>
                        {plan.id === 'free' ? (
                          <span className={styles.period}>or $0/year</span>
                        ) : (
                          <>
                            <span className={styles.currency}>$</span>
                            <span className={styles.priceSmall}>{yearlyPrice}</span>
                            <span className={styles.period}>/year</span>
                            {showSavings && (
                              <span className={styles.saveBadgeSmall}>Save 17%</span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <ul className={styles.features}>
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className={styles.feature}>
                        <span
                          className={`${styles.checkIcon} ${
                            feature.included ? styles.included : styles.notIncluded
                          }`}
                        >
                          {feature.included ? '✓' : '×'}
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
                      ? 'Get Started'
                      : isAnnual
                      ? 'Save with Annual'
                      : 'Start Monthly'}
                  </Button>

                  <p className={styles.trustLine}>
                    Cancel anytime • Secure payments
                  </p>
                </div>
              );
            })}
          </div>

          <aside className={`${styles.sidePanel} ${styles.rightPanel}`} aria-hidden="true">
            <div className={styles.panelImageFrame}>
              <img
                src={sidePanels[1].image}
                alt={sidePanels[1].alt}
                width={sidePanels[1].width}
                height={sidePanels[1].height}
                loading="lazy"
                decoding="async"
                className={styles.panelImage}
              />
            </div>
            <div className={styles.panelCopy}>
              <span className={styles.panelKicker}>{sidePanels[1].kicker}</span>
              <p className={styles.panelTitle}>{sidePanels[1].title}</p>
              <p className={styles.panelSubtitle}>{sidePanels[1].subtitle}</p>
            </div>
          </aside>
        </div>
      </Container>
    </section>
  );
};
