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
          <div className={styles.badge}>
            ⚡ Trusted by 10,000+ athletes worldwide
          </div>
          <h1 className={styles.heroTitle}>
            Simple pricing. Start free.
          </h1>
          <p className={styles.heroSubtitle}>
            Upgrade only when you want unlimited matching, AI compatibility scoring, and priority placement.
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
