import React, { useState, useEffect, useRef } from 'react';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import { useI18n } from '@/hooks/useI18n';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useMe } from '@/hooks/useMe';
import { analytics } from '@/utils/analytics';
import { LanguageDropdown } from '@/components/layout/LanguageDropdown';
import { HeaderNavLink } from './HeaderNavLink';
import styles from './AppHeader.module.css';

export const AppHeader: React.FC = () => {
  const { t } = useI18n();
  const { user, logout } = useAuthContext();
  const { me } = useMe();
  const navigate = useNavigate();
  const location = useLocation();
  const isAppRoute = location.pathname.startsWith('/app');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);

  const isLoggedIn = !!user;
  const profileComplete = me?.isProfileComplete ?? true;
  const isAdmin = me?.isAdmin ?? user?.groups?.includes('Admin') ?? false;

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
    };
    if (userOpen) {
      document.addEventListener('mousedown', fn);
      return () => document.removeEventListener('mousedown', fn);
    }
  }, [userOpen]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMobileOpen(false); setUserOpen(false); } };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, []);

  const handleLogout = async () => { setUserOpen(false); setMobileOpen(false); await logout(); navigate('/'); };

  // Logged out: full nav + Pricing (no Upgrade). Logged in: app nav only, no Pricing; Upgrade is the single CTA.
  const appNavItems: { label: string; href: string; icon?: string; exact?: boolean }[] = [
    { label: t('nav.discover'), href: '/app/discover' },
    { label: t('nav.match'), href: '/app/matches' },
    { label: t('nav.chat'), href: '/app/chat' },
    { label: t('nav.events'), href: '/app/events' },
  ];
  const loggedOutNav: { label: string; href: string; icon?: string; exact?: boolean }[] = [
    ...appNavItems,
    { label: t('header.pricing'), href: '/pricing', icon: '💰', exact: true },
  ];
  const loggedInNav = appNavItems;
  const navItems = isLoggedIn ? loggedInNav : loggedOutNav;
  const logoTo = '/';

  return (
    <header className={styles.root}>
      <div className={styles.inner}>
        <RouterLink to={logoTo} className={styles.logo} aria-label={t('common.appName')} onClick={(e) => e.stopPropagation()}>
          <span className={styles.logoIcon}>⚡</span>
          <span className={styles.logoText}>{t('common.appName')}</span>
        </RouterLink>

        <nav className={styles.nav} aria-label="Main navigation">
          {navItems.map((item) => (
            <HeaderNavLink
              key={item.href}
              to={item.href}
              label={item.label}
              icon={item.icon}
              exact={item.exact ?? false}
            />
          ))}
        </nav>

        <div className={styles.actions}>
          <div className={styles.langWrap}>
            <LanguageDropdown />
          </div>

          {isLoggedIn && (
            <>
              <RouterLink to="/pricing" className={styles.creditsPill} aria-label="Your credits">
                <span className={styles.creditsValue}>{me?.credits ?? 0}</span>
                <span className={styles.creditsLabel}>credits</span>
              </RouterLink>
              <RouterLink
                to="/pricing"
                className={styles.upgradeBtn}
                onClick={() => analytics.pricingOpened('header')}
              >
                Upgrade
              </RouterLink>
            </>
          )}

          {isLoggedIn ? (
            <div className={`${styles.userWrap} ${userOpen ? styles.userOpen : ''}`} ref={userRef}>
              <button
                type="button"
                className={styles.userBtn}
                onClick={() => setUserOpen(!userOpen)}
                aria-expanded={userOpen}
                aria-haspopup="true"
                aria-label={`${me?.profile?.name || user?.email || 'User'} menu`}
              >
                <span className={styles.userName}>
                  {me?.profile?.name?.trim() || user?.email?.split('@')[0] || 'Profile'}
                </span>
                {!profileComplete && <span className={styles.badge} aria-label="Profile incomplete">!</span>}
                <svg className={styles.chevron} width="10" height="10" viewBox="0 0 12 12" aria-hidden>
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
              </button>
              {userOpen && (
                <div className={styles.dropdown}>
                  {!profileComplete && (
                    <RouterLink to="/onboarding/profile" className={styles.dropItem} onClick={() => setUserOpen(false)}>
                      Complete Profile
                    </RouterLink>
                  )}
                  <RouterLink to="/app/profile" className={styles.dropItem} onClick={() => setUserOpen(false)}>
                    {t('header.profile')}
                  </RouterLink>
                  <RouterLink to="/app/subscription" className={styles.dropItem} onClick={() => setUserOpen(false)}>
                    {t('header.billing')}
                  </RouterLink>
                  {isAdmin && (
                    <RouterLink to="/admin" className={styles.dropItem} onClick={() => setUserOpen(false)}>
                      {t('header.admin')}
                    </RouterLink>
                  )}
                  <div className={styles.dropDiv} />
                  <button type="button" className={`${styles.dropItem} ${styles.dropDanger}`} onClick={handleLogout}>
                    {t('common.logout')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className={styles.authWrap}>
              <RouterLink to="/login" className={styles.loginBtn}>
                {t('header.login')}
              </RouterLink>
              <RouterLink to="/signup" className={styles.signupBtn}>
                {t('header.signup')}
              </RouterLink>
            </div>
          )}

          <button
            type="button"
            className={styles.mobileBtn}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-expanded={mobileOpen}
            aria-label="Menu"
          >
            <span className={`${styles.ham} ${mobileOpen ? styles.hamOpen : ''}`}>
              <span /><span /><span />
            </span>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <>
          <div className={styles.overlay} onClick={() => setMobileOpen(false)} aria-hidden />
          <div className={styles.mobileMenu}>
            <nav className={styles.mobileNav}>
              {navItems.map(({ label, href }) => (
                <RouterLink key={href} to={href} className={styles.mobileLink} onClick={() => setMobileOpen(false)}>
                  {href === '/pricing' ? <>💰 {label}</> : label}
                </RouterLink>
              ))}
            </nav>
            <div className={styles.mobileActions}>
              <div className={styles.mobileLangWrap}>
                <LanguageDropdown />
              </div>
              {isLoggedIn ? (
                <>
                  <div className={styles.mobileUser} aria-hidden>
                    {me?.profile?.name?.trim() || user?.email?.split('@')[0] || 'Profile'}
                  </div>
                  <RouterLink to="/pricing" className={styles.mobileCredits} onClick={() => { setMobileOpen(false); analytics.pricingOpened('mobile'); }}>
                    {me?.credits ?? 0} credits
                  </RouterLink>
                  <RouterLink to="/pricing" className={styles.mobileUpgrade} onClick={() => { setMobileOpen(false); analytics.pricingOpened('mobile'); }}>
                    Upgrade
                  </RouterLink>
                  <RouterLink to="/app/profile" className={styles.mobileLink} onClick={() => setMobileOpen(false)}>{t('header.profile')}</RouterLink>
                  <button type="button" className={styles.mobileLogout} onClick={handleLogout}>{t('common.logout')}</button>
                </>
              ) : (
                <>
                  <RouterLink to="/login" className={styles.mobileLink} onClick={() => setMobileOpen(false)}>{t('header.login')}</RouterLink>
                  <RouterLink to="/signup" className={styles.mobileSignup} onClick={() => setMobileOpen(false)}>{t('header.signup')}</RouterLink>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </header>
  );
};
