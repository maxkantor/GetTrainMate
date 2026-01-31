import React from 'react';
import { PricingHero } from '@/components/pricing/PricingHero';
import { PricingCards } from '@/components/pricing/PricingCards';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';
import styles from '@/pages/Pricing.module.css';

/** Minimal pricing: Hero, 3 cards, trust line, final CTA. No toggle, table, FAQ, boosts, challenges. */
export const PricingPage: React.FC = () => (
  <main className={styles.page}>
    <PricingHero />
    <PricingCards />
    <p className={styles.trustLine}>Cancel anytime. Secure payments.</p>
    <section className={styles.finalCta}>
      <Container>
        <p className={styles.finalCtaText}>Start free. Upgrade when it works for you.</p>
        <Button as="a" href="/signup" variant="primary" size="lg">
          Start Free
        </Button>
      </Container>
    </section>
  </main>
);
