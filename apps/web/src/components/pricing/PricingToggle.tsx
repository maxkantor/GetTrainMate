import React from 'react';
import styles from './PricingToggle.module.css';

interface PricingToggleProps {
  isAnnual: boolean;
  onChange: (isAnnual: boolean) => void;
}

export const PricingToggle: React.FC<PricingToggleProps> = ({ isAnnual, onChange }) => {
  return (
    <div className={styles.toggleContainer}>
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
      <span className={`${styles.toggleLabel} ${isAnnual ? styles.active : ''}`}>
        Annual
        <span className={styles.saveBadge}>Save 17%</span>
      </span>
    </div>
  );
};
