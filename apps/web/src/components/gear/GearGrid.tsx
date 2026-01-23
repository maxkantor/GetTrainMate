import React from 'react';
import { Button } from '@/components/ui/Button';
import { gearProducts } from '@/data/gearData';
import { buildAmazonAffiliateUrl } from '@/config/affiliate';
import styles from './GearGrid.module.css';

export const GearGrid: React.FC = () => {
  const gearEmojis: Record<string, string> = {
    Footwear: '👟',
    Accessories: '🎽',
    Nutrition: '🥤',
    Equipment: '🎯',
    Tech: '⌚',
  };

  return (
    <div>
      <div className={styles.gearGrid}>
        {gearProducts.map((product) => {
          const amazonUrl = buildAmazonAffiliateUrl(product.asin);

          return (
            <div key={product.id} className={styles.gearCard}>
              <div className={styles.gearImage}>
                <div className={styles.categoryBadge}>{product.category}</div>
                {gearEmojis[product.category] || '🏋️'}
              </div>

              <div className={styles.gearContent}>
                <h3 className={styles.gearName}>{product.name}</h3>

                <ul className={styles.reasonsList}>
                  {product.reasons.map((reason, idx) => (
                    <li key={idx} className={styles.reasonItem}>
                      <span className={styles.checkIcon}>✓</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  as="a"
                  href={amazonUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="secondary"
                  size="lg"
                  className={styles.buyButton}
                >
                  <span className={styles.amazonIcon}>📦</span>
                  <span>Buy on Amazon</span>
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.disclaimer}>
        <strong>Disclosure:</strong> As an Amazon Associate we earn from qualifying purchases.
        This helps us keep GetTrainMate free for all users. Thank you for your support!
      </div>
    </div>
  );
};
