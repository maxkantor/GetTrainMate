import React from 'react';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/layout/Container';
import styles from './PricingHero.module.css';

export const PricingHero: React.FC = () => {
  const scrollToPlans = () => {
    document.getElementById('pricing-plans')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className={styles.pricingHero}>
      <Container>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            Train Smarter. Match Faster. Get Results.
          </h1>
          <p className={styles.heroSubtitle}>
            AI-powered matching, verified athletes, and accountability partners. Start free and upgrade when you’re ready.
          </p>
          <div className={styles.heroCta}>
            <Button as="a" href="/signup" variant="primary" size="lg">
              Start Free
            </Button>
            <Button variant="secondary" size="lg" onClick={scrollToPlans}>
              Compare Plans
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
};
