import React, { useState, useEffect, useRef } from 'react';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import { useI18n } from '@/hooks/useI18n';
import { useAuthContext } from '@/hooks/useAuthContext';
import { profileService } from '@/services/profileService';
import { authService } from '@/services/authService';
import { SUPPORTED_LOCALES } from '@/i18n';
import { Container } from './Container';
import styles from './Header.module.css';

export const Header: React.FC = () => {
  const { t, locale, setLocale } = useI18n();
  const { isAuthenticated, user, logout } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [profileComplete, setProfileComplete] = useState(true);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Handle scroll for transparent header
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Check profile completion status
  useEffect(() => {
    const checkProfile = async () => {
      if (!isAuthenticated) {
        setProfileComplete(true);
        return;
      }

      try {
        const token = await authService.getJWT();
        if (!token) {
          setProfileComplete(true);
          return;
        }
        const profile = await profileService.getMyProfile(token);
        setProfileComplete(profile.isComplete || false);
      } catch (error) {
        console.error('Error checking profile:', error);
        setProfileComplete(false);
      }
    };

    if (isAuthenticated) {
      checkProfile();
    }
  }, [isAuthenticated, location.pathname]);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [userMenuOpen]);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement;
        if (!target.closest(`.${styles.mobileMenuButton}`)) {
          setMobileMenuOpen(false);
        }
      }
    };
    if (mobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [mobileMenuOpen]);

  // Close menus on ESC
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, []);

  const handleLogout = async () => {
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
    await logout();
    navigate('/');
  };

  // Public nav items (only show when NOT authenticated)
  const publicNavItems = [
    { label: t('header.pricing'), href: '/pricing' },
    { label: t('header.about'), href: '/about' },
    { label: t('header.faq'), href: '/faq' },
    { label: t('header.contact'), href: '/contact' },
  ];

  // Authenticated nav items (only show when authenticated)
  const authNavItems = [
    { label: t('nav.dashboard'), href: '/app/discover' },
    { label: t('nav.match'), href: '/app/matches' },
    { label: t('nav.chat'), href: '/app/chat' },
    { label: t('nav.events'), href: '/app/events' },
  ];

  // Determine which nav items to show based on auth state
  const navItems = isAuthenticated ? authNavItems : publicNavItems;

  const isActiveRoute = (href: string) => {
    if (href === '/app/discover' || href === '/app/dashboard') {
      return location.pathname === '/app/discover' || location.pathname === '/app/dashboard';
    }
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  // Transparent header on landing page when not scrolled
  const isLandingPage = location.pathname === '/';
  const isTransparent = isLandingPage && !scrolled;

  return (
    <header className={`${styles.header} ${scrolled ? styles.scrolled : ''} ${isTransparent ? styles.transparent : ''}`}>
      <Container>
        <div className={styles.headerInner}>
          {/* Logo - Left */}
          <RouterLink to="/" className={styles.logo} aria-label="GetTrainMate Home">
            <span className={styles.logoIcon}>⚡</span>
            <span className={styles.logoText}>{t('common.appName')}</span>
          </RouterLink>

          {/* Desktop Navigation - Center */}
          <nav className={styles.desktopNav} aria-label="Main navigation">
            {navItems.map((item) => (
              <RouterLink
                key={item.href}
                to={item.href}
                className={`${styles.navLink} ${isActiveRoute(item.href) ? styles.activeLink : ''}`}
              >
                {item.label}
              </RouterLink>
            ))}
          </nav>

          {/* Right Side - Language + Auth */}
          <div className={styles.headerRight}>
            {/* Language Selector - Desktop only */}
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

            {/* Auth Section */}
            {isAuthenticated && user ? (
              <div className={styles.userMenuWrapper} ref={userMenuRef}>
                <button
                  className={styles.userButton}
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  aria-label="User menu"
                  aria-expanded={userMenuOpen}
                  aria-haspopup="true"
                >
                  <div className={styles.avatarWrapper}>
                    <div className={styles.avatar}>
                      {user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    {!profileComplete && (
                      <span className={styles.profileBadge} aria-label="Complete your profile">
                        !
                      </span>
                    )}
                  </div>
                  <svg
                    className={`${styles.chevron} ${userMenuOpen ? styles.chevronOpen : ''}`}
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                  >
                    <path
                      d="M3 4.5L6 7.5L9 4.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>

                {/* User Dropdown */}
                {userMenuOpen && (
                  <div className={styles.userDropdown} role="menu">
                    <RouterLink
                      to={profileComplete ? '/app/profile' : '/onboarding/profile'}
                      className={styles.dropdownItem}
                      onClick={() => setUserMenuOpen(false)}
                      role="menuitem"
                    >
                      <span>{t('header.profile')}</span>
                      {!profileComplete && <span className={styles.incompleteBadge}>!</span>}
                    </RouterLink>
                    <RouterLink
                      to="/app/subscription"
                      className={styles.dropdownItem}
                      onClick={() => setUserMenuOpen(false)}
                      role="menuitem"
                    >
                      {t('header.billing') || 'Billing'}
                    </RouterLink>
                    {user.groups?.includes('Admin') && (
                      <RouterLink
                        to="/admin"
                        className={styles.dropdownItem}
                        onClick={() => setUserMenuOpen(false)}
                        role="menuitem"
                      >
                        {t('header.admin')}
                      </RouterLink>
                    )}
                    <div className={styles.dropdownDivider} />
                    <button
                      className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`}
                      onClick={handleLogout}
                      role="menuitem"
                    >
                      {t('common.logout')}
                    </button>
                  </div>
                )}
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

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <>
          <div
            className={styles.mobileMenuOverlay}
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className={styles.mobileMenu} ref={mobileMenuRef}>
            <div className={styles.mobileMenuHeader}>
              <RouterLink
                to="/"
                className={styles.mobileLogo}
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className={styles.logoIcon}>⚡</span>
                <span className={styles.logoText}>{t('common.appName')}</span>
              </RouterLink>
              <button
                className={styles.mobileMenuClose}
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
              >
                ×
              </button>
            </div>

            <nav className={styles.mobileNav} aria-label="Mobile navigation">
              {navItems.map((item) => (
                <RouterLink
                  key={item.href}
                  to={item.href}
                  className={`${styles.mobileNavLink} ${isActiveRoute(item.href) ? styles.mobileNavLinkActive : ''}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </RouterLink>
              ))}
            </nav>

            <div className={styles.mobileMenuFooter}>
              <div className={styles.mobileLanguage}>
                <label htmlFor="mobile-language-select" className={styles.mobileLanguageLabel}>
                  {t('common.language')}
                </label>
                <select
                  id="mobile-language-select"
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
                    to={profileComplete ? '/app/profile' : '/onboarding/profile'}
                    className={styles.mobileButton}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t('header.profile')}
                    {!profileComplete && <span className={styles.mobileIncompleteBadge}>!</span>}
                  </RouterLink>
                  <RouterLink
                    to="/app/subscription"
                    className={styles.mobileButton}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t('header.billing') || 'Billing'}
                  </RouterLink>
                  {user.groups?.includes('Admin') && (
                    <RouterLink
                      to="/admin"
                      className={styles.mobileButton}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {t('header.admin')}
                    </RouterLink>
                  )}
                  <button
                    onClick={handleLogout}
                    className={`${styles.mobileButton} ${styles.mobileButtonDanger}`}
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
