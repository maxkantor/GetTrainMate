import React from 'react';
import { BackLink } from '@/components/ui/BackLink';
import styles from './SecondaryPageLayout.module.css';

export type SecondaryPageVariant = 'form' | 'content' | 'pricing';

interface SecondaryPageLayoutProps {
  variant: SecondaryPageVariant;
  title?: string;
  subtitle?: string;
  showBackLink?: boolean;
  children: React.ReactNode;
}

export const SecondaryPageLayout: React.FC<SecondaryPageLayoutProps> = ({
  variant,
  title,
  subtitle,
  showBackLink = true,
  children,
}) => {
  return (
    <div className={`${styles.root} ${styles[variant]}`} data-variant={variant}>
      <div className={styles.bg} aria-hidden />
      <div className={styles.inner}>
        {showBackLink && (
          <div className={styles.backStrip}>
            <BackLink label="Back" />
          </div>
        )}
        <div className={styles.card}>
          {title != null && (
            <div className={styles.header}>
              <h1 className={styles.title}>{title}</h1>
              {subtitle != null && <p className={styles.subtitle}>{subtitle}</p>}
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
};
