import React from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useI18n } from '@/hooks/useI18n';
import { Container } from './Container';
import styles from './Footer.module.css';

export const Footer: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();

  const handleFooterLink = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    navigate(href);
  };

  const footerSections = {
    product: [
      { label: t('header.about'), href: '/about' },
      { label: t('header.faq'), href: '/faq' },
    ],
    company: [
      { label: t('header.contact'), href: '/contact' },
    ],
    legal: [
      { label: t('footer.privacy'), href: '/privacy' },
      { label: t('footer.terms'), href: '/terms' },
    ],
  };

  return (
    <footer className={styles.footer}>
      <Container>
        <div className={styles.footerContent}>
          {/* Brand Column */}
          <div className={styles.brandColumn}>
            <div className={styles.logo}>
              <span className={styles.logoIcon}>⚡</span>
              <span className={styles.logoText}>{t('common.appName')}</span>
            </div>
            <p className={styles.tagline}>
              Find your perfect training partner and achieve your fitness goals together.
            </p>
            <div className={styles.social}>
              <a href="#" className={styles.socialLink} aria-label="Twitter">
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z" />
                </svg>
              </a>
              <a href="#" className={styles.socialLink} aria-label="Instagram">
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37zm1.5-4.87h.01" />
                </svg>
              </a>
              <a href="#" className={styles.socialLink} aria-label="LinkedIn">
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z" />
                  <circle cx="4" cy="4" r="2" />
                </svg>
              </a>
            </div>
          </div>

          {/* Product */}
          <div className={styles.linksColumn}>
            <h3 className={styles.columnTitle}>Product</h3>
            <ul className={styles.linksList}>
              {footerSections.product.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className={styles.link} onClick={(e) => handleFooterLink(e, link.href)}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div className={styles.linksColumn}>
            <h3 className={styles.columnTitle}>Company</h3>
            <ul className={styles.linksList}>
              {footerSections.company.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className={styles.link} onClick={(e) => handleFooterLink(e, link.href)}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div className={styles.linksColumn}>
            <h3 className={styles.columnTitle}>Legal</h3>
            <ul className={styles.linksList}>
              {footerSections.legal.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className={styles.link} onClick={(e) => handleFooterLink(e, link.href)}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className={styles.bottomBar}>
          <p className={styles.copyright}>
            © {new Date().getFullYear()} {t('common.appName')}. All rights reserved.
          </p>
        </div>
      </Container>
    </footer>
  );
};
