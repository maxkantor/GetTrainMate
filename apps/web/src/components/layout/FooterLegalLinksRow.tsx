import React from 'react';
import { SamePathScrollLink } from '@/components/SamePathScrollLink';
import { useI18n } from '@/hooks/useI18n';
import { FOOTER_LINKS_COMPACT } from '@/config/footerLinks';
import styles from './Footer.module.css';

type Props = {
  /** Optional: close parent modal when navigating (e.g. landing entry flow). */
  onLinkClick?: () => void;
  /** `modal`: tighter spacing for overlays; `compact`: default app/landing strip. */
  variant?: 'compact' | 'modal';
};

export const FooterLegalLinksRow: React.FC<Props> = ({ onLinkClick, variant = 'compact' }) => {
  const { t } = useI18n();
  const linkClass =
    variant === 'modal' ? `${styles.footerCompactLink} ${styles.footerModalLink}` : styles.footerCompactLink;

  return (
    <div
      className={
        variant === 'modal' ? `${styles.footerCompactLinks} ${styles.footerModalLinks}` : styles.footerCompactLinks
      }
    >
      {FOOTER_LINKS_COMPACT.map((link) => (
        <SamePathScrollLink key={link.to} to={link.to} className={linkClass} onClick={onLinkClick}>
          {t(link.labelKey)}
        </SamePathScrollLink>
      ))}
    </div>
  );
};
