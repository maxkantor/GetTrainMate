import React from 'react';
import styles from './PricingToggle.module.css';

interface PricingToggleProps {
  isAnnual: boolean;
  onChange: (isAnnual: boolean) => void;
}

export const PricingToggle: React.FC<PricingToggleProps> = ({ isAnnual, onChange }) => {
  return (
    <div className={styles.toggleContainer}>
      <div className={styles.toggleRow}>
        <span className={`${styles.toggleLabel} ${!isAnnual ? styles.active : ''}`}>
          Monthly
        </span>
        <label className={`${styles.toggle} ${isAnnual ? styles.checked : ''}`}>
          <input
            type="checkbox"
            checked={isAnnual}
            onChange={(e) => onChange(e.target.checked)}
            className={styles.toggleInput}
            aria-label="Toggle between monthly and annual billing"
          />
          <span className={styles.toggleSlider} />
        </label>
        <div className={`${styles.toggleLabelWrap} ${isAnnual ? styles.active : ''}`}>
          <span className={styles.toggleLabel}>Annual</span>
          <span className={styles.popularNote}>Save 17% — most popular</span>
        </div>
      </div>
    </div>
  );
};
