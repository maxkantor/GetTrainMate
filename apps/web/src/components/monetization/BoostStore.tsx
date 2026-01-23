import React from 'react';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';
import { boostPacks } from '@/data/monetizationData';
import styles from './BoostStore.module.css';

export const BoostStore: React.FC = () => {
  const purchaseBoostPack = (packId: string) => {
    // TODO: Connect to backend payment processing
    console.log('Purchase boost pack:', packId);
    alert(`Purchasing boost pack: ${packId}. Payment integration coming soon!`);
  };

  return (
    <section className={styles.boostSection}>
      <Container size="xl">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Profile Boosts</h2>
          <p className={styles.sectionSubtitle}>
            Stand out and get noticed. Boost your profile to the top of the match feed for 30 minutes.
          </p>
        </div>

        <div className={styles.boostGrid}>
          {boostPacks.map((pack) => (
            <div
              key={pack.id}
              className={`${styles.boostCard} ${pack.badge ? styles.bestValue : ''}`}
            >
              {pack.badge && <div className={styles.badge}>{pack.badge}</div>}

              <div className={styles.boostIcon}>🚀</div>

              {pack.savings && (
                <div className={styles.savingsBadge}>{pack.savings}</div>
              )}

              <h3 className={styles.boostName}>{pack.name}</h3>
              <div className={styles.boostPrice}>${pack.price}</div>

              <p className={styles.boostDescription}>
                {pack.count === 1
                  ? 'Single boost to test visibility'
                  : pack.count === 5
                  ? 'Perfect for weekly visibility'
                  : 'Maximum value for power users'}
              </p>

              <Button
                variant={pack.badge ? 'primary' : 'secondary'}
                size="lg"
                onClick={() => purchaseBoostPack(pack.id)}
                className={styles.boostButton}
              >
                Buy {pack.count} Boost{pack.count > 1 ? 's' : ''}
              </Button>
            </div>
          ))}
        </div>

        <div className={styles.boostInfo}>
          <h3 className={styles.infoTitle}>How Boosts Work</h3>
          <p className={styles.infoText}>
            When you activate a boost, your profile appears at the top of the match feed for 30 minutes,
            dramatically increasing your visibility. Perfect for when you're actively looking for training
            partners or want to maximize your matches quickly.
          </p>
        </div>
      </Container>
    </section>
  );
};
