import React from 'react';
import { Container } from '@/components/layout/Container';
import { PRICING_VIBE_IMAGES } from '@/config/media';
import styles from './PricingVibeStrip.module.css';

export const PricingVibeStrip: React.FC = () => {
  return (
    <section aria-label="Meet the vibe" className={styles.stripSection}>
      <Container>
        <div className={styles.stripContainer}>
          {PRICING_VIBE_IMAGES.map((img, idx) => (
            <figure key={idx} className={styles.item}>
              <img
                className={styles.img}
                src={img.src}
                onError={(e) => {
                  if (img.fallback && (e.target as HTMLImageElement).src !== img.fallback) {
                    (e.target as HTMLImageElement).src = img.fallback;
                  }
                }}
                alt={img.alt}
                width={img.width}
                height={img.height}
                loading="lazy"
                decoding="async"
              />
              <figcaption className={styles.caption}>{img.caption}</figcaption>
            </figure>
          ))}
        </div>
      </Container>
    </section>
  );
};
