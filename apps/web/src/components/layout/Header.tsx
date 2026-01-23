import React, { useState, useEffect } from 'react';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import { useI18n } from '@/hooks/useI18n';
import { useAuthContext } from '@/hooks/useAuthContext';
import { SUPPORTED_LOCALES } from '@/i18n';
import { Container } from './Container';
import styles from './Header.module.css';

export const Header: React.FC = () => {
  const { t, locale, setLocale } = useI18n();
  const { isAuthenticated, user, logout } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('');

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (location.pathname !== '/') return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-100px 0px -66%' }
    );

    const sections = document.querySelectorAll('section[id]');
    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, [location]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navItems = [
    { label: t('header.pricing'), href: '/pricing', id: 'pricing' },
    { label: t('header.about'), href: '/about', id: 'about' },
    { label: t('header.faq'), href: '/faq', id: 'faq' },
    { label: t('header.contact'), href: '/contact', id: 'contact' },
  ];

  const appNavItems = [
    { label: t('nav.dashboard'), href: '/app/discover' },
    { label: t('nav.match'), href: '/app/matches' },
    { label: t('nav.chat'), href: '/app/chat' },
    { label: t('nav.events'), href: '/app/events' },
  ];

  const isActive = (itemId: string) => {
    if (location.pathname === '/') {
      return activeSection === itemId;
    }
    return location.pathname.includes(itemId);
  };

  return (
    <header className={`${styles.header} ${scrolled ? styles.scrolled : ''}`}>
      <Container>
        <div className={styles.headerInner}>
          {/* Logo */}
          <RouterLink to="/" className={styles.logo}>
            <span className={styles.logoIcon}>⚡</span>
            <span className={styles.logoText}>{t('common.appName')}</span>
          </RouterLink>

          {/* Desktop Navigation */}
          <nav className={styles.desktopNav}>
            {isAuthenticated
              ? appNavItems.map((item) => (
                  <RouterLink
                    key={item.href}
                    to={item.href}
                    className={`${styles.navLink} ${location.pathname === item.href ? styles.activeLink : ''}`}
                  >
                    {item.label}
                  </RouterLink>
                ))
              : navItems.map((item) => (
                  <RouterLink
                    key={item.href}
                    to={item.href}
                    className={`${styles.navLink} ${isActive(item.id) ? styles.activeLink : ''}`}
                  >
                    {item.label}
                  </RouterLink>
                ))}
          </nav>

          {/* Right side - Language & Auth */}
          <div className={styles.headerActions}>
            {/* Language Selector */}
            <div className={styles.languageSelector}>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value as any)}
                className={styles.languageSelect}
                aria-label="Select language"
              >
                {SUPPORTED_LOCALES.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            {/* Auth Buttons */}
            {isAuthenticated && user ? (
              <div className={styles.userMenu}>
                <RouterLink to="/app/profile" className={styles.userButton}>
                  <div className={styles.avatar}>
                    {user.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <span className={styles.userName}>{user.name}</span>
                </RouterLink>
                <button onClick={handleLogout} className={styles.logoutButton}>
                  {t('common.logout')}
                </button>
              </div>
            ) : (
              <div className={styles.authButtons}>
                <RouterLink to="/login" className={styles.loginButton}>
                  {t('header.login')}
                </RouterLink>
                <RouterLink to="/signup" className={styles.signupButton}>
                  {t('header.signup')}
                </RouterLink>
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <button
              className={styles.mobileMenuButton}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              <span className={`${styles.hamburger} ${mobileMenuOpen ? styles.hamburgerOpen : ''}`}>
                <span></span>
                <span></span>
                <span></span>
              </span>
            </button>
          </div>
        </div>
      </Container>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <>
          <div 
            className={styles.mobileMenuOverlay} 
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className={styles.mobileMenu}>
            <nav className={styles.mobileNav}>
              {(isAuthenticated ? appNavItems : navItems).map((item) => (
                <RouterLink
                  key={item.href}
                  to={item.href}
                  className={styles.mobileNavLink}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </RouterLink>
              ))}
            </nav>

            <div className={styles.mobileMenuFooter}>
              <div className={styles.mobileLanguage}>
                <select
                  value={locale}
                  onChange={(e) => setLocale(e.target.value as any)}
                  className={styles.languageSelect}
                >
                  {SUPPORTED_LOCALES.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              {isAuthenticated && user ? (
                <div className={styles.mobileAuthButtons}>
                  <RouterLink 
                    to="/app/profile" 
                    className={styles.mobileButton}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t('header.profile')}
                  </RouterLink>
                  <button
                    onClick={() => {
                      handleLogout();
                      setMobileMenuOpen(false);
                    }}
                    className={styles.mobileButton}
                  >
                    {t('common.logout')}
                  </button>
                </div>
              ) : (
                <div className={styles.mobileAuthButtons}>
                  <RouterLink 
                    to="/login" 
                    className={styles.mobileButton}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t('header.login')}
                  </RouterLink>
                  <RouterLink 
                    to="/signup" 
                    className={`${styles.mobileButton} ${styles.mobileButtonPrimary}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t('header.signup')}
                  </RouterLink>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </header>
  );
};
