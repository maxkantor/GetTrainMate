import React from 'react';
import { SamePathScrollLink } from '@/components/SamePathScrollLink';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useI18n } from '@/hooks/useI18n';
import { FOOTER_SECTIONS } from '@/config/footerLinks';
import { LogoFull } from '@/components/brand/Logo';
import { Container } from './Container';
import styles from './Footer.module.css';

interface FooterProps {
  /** Extra bottom padding on mobile when the fixed app bottom nav is visible. */
  reserveBottomNav?: boolean;
}

export const Footer: React.FC<FooterProps> = ({ reserveBottomNav = false }) => {
  const { t } = useI18n();
  const { isAuthenticated } = useAuthContext();
  const brandHref = isAuthenticated ? '/app' : '/';

  const footerSections = {
    product: FOOTER_SECTIONS.product.map((link) => ({ label: t(link.labelKey), href: link.to })),
    company: FOOTER_SECTIONS.company.map((link) => ({ label: t(link.labelKey), href: link.to })),
    legal: FOOTER_SECTIONS.legal.map((link) => ({ label: t(link.labelKey), href: link.to })),
  };

  return (
    <footer className={`${styles.footer} ${reserveBottomNav ? styles.footerReserveBottomNav : ''}`}>
      <Container>
        <div className={styles.footerContent}>
          {/* Brand: marketing home when logged out; app dashboard when logged in */}
          <div className={styles.brandColumn}>
            <SamePathScrollLink to={brandHref} className={`${styles.logo} ${styles.brandLogoLink}`}>
              <LogoFull
                label={t('common.appName')}
                size="lg"
                variant="main"
                iconClassName={styles.logoIcon}
                textClassName={styles.logoText}
              />
            </SamePathScrollLink>
            <p className={styles.tagline}>
              {t('footer.tagline')}
            </p>
            <div className={styles.social}>
              <a
                href="https://www.facebook.com/gettrainmate"
                className={styles.socialLink}
                aria-label="Facebook"
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
              <a
                href="https://www.instagram.com/gettrainmate/"
                className={styles.socialLink}
                aria-label="Instagram"
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Product */}
          <div className={styles.linksColumn}>
            <h3 className={styles.columnTitle}>{t('footer.product')}</h3>
            <ul className={styles.linksList}>
              {footerSections.product.map((link) => (
                <li key={link.href}>
                  <SamePathScrollLink to={link.href} className={styles.link}>
                    {link.label}
                  </SamePathScrollLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div className={styles.linksColumn}>
            <h3 className={styles.columnTitle}>{t('footer.company')}</h3>
            <ul className={styles.linksList}>
              {footerSections.company.map((link) => (
                <li key={link.href}>
                  <SamePathScrollLink to={link.href} className={styles.link}>
                    {link.label}
                  </SamePathScrollLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div className={styles.linksColumn}>
            <h3 className={styles.columnTitle}>{t('footer.legal')}</h3>
            <ul className={styles.linksList}>
              {footerSections.legal.map((link) => (
                <li key={link.href}>
                  <SamePathScrollLink to={link.href} className={styles.link}>
                    {link.label}
                  </SamePathScrollLink>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className={styles.bottomBar}>
          <p className={styles.copyright}>
            © {new Date().getFullYear()} {t('common.appName')}. {t('footer.all_rights_reserved')}
          </p>
        </div>
      </Container>
    </footer>
  );
};
