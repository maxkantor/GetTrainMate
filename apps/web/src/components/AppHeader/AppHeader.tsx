import React, { useState, useEffect, useRef } from 'react';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import { useI18n } from '@/hooks/useI18n';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useMe } from '@/hooks/useMe';
import { analytics } from '@/utils/analytics';
import { LanguageDropdown } from '@/components/layout/LanguageDropdown';
import { HeaderNavLink } from './HeaderNavLink';
import { useLandingConversion } from '@/contexts/LandingConversionContext';
import { useMatchStatusForHeader } from '@/hooks/useMatchStatusForHeader';
import { DAILY_LIKE_LIMIT } from '@/config/appLimits';
import styles from './AppHeader.module.css';

export const AppHeader: React.FC = () => {
  const { t } = useI18n();
  const { user, logout } = useAuthContext();
  const { me } = useMe();
  const { openEntryFlow } = useLandingConversion();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);

  const isLoggedIn = !!user;
  const profileComplete = me?.isProfileComplete ?? true;
  const isAdmin = me?.isAdmin ?? user?.groups?.includes('Admin') ?? false;
  const matchStatus = useMatchStatusForHeader(isLoggedIn);

  const credits = me?.credits ?? 0;
  const creditCap = Math.max(me?.lifetimeEarned ?? 0, 6);
  const lowCredits = credits <= 1;

  const statusLine =
    !matchStatus.loading && matchStatus.waitingForAction > 0
      ? `${matchStatus.waitingForAction} match${matchStatus.waitingForAction === 1 ? '' : 'es'} waiting`
      : `${matchStatus.likesToday}/${DAILY_LIKE_LIMIT} matches used today`;

  const avatarLetter =
    me?.profile?.name?.trim()?.charAt(0)?.toUpperCase() ||
    user?.email?.charAt(0)?.toUpperCase() ||
    '?';

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
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
        setUserOpen(false);
      }
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, []);

  const handleLogout = async () => {
    setUserOpen(false);
    setMobileOpen(false);
    await logout();
    navigate('/');
  };

  const appNavItems: { label: string; href: string; icon?: string; exact?: boolean }[] = [
    { label: t('nav.discover'), href: '/app/discover' },
    { label: t('nav.match'), href: '/app/matches' },
    { label: t('nav.chat'), href: '/app/chat' },
    { label: t('nav.events'), href: '/app/events' },
  ];
  const loggedInNav = appNavItems;
  const navItems = isLoggedIn ? loggedInNav : [];
  const logoTo = '/';

  return (
    <header className={styles.root}>
      <div className={styles.inner}>
        {!isLoggedIn ? (
          <>
            <RouterLink to={logoTo} className={styles.logo} aria-label={t('common.appName')} onClick={(e) => e.stopPropagation()}>
              <span className={styles.logoIcon}>⚡</span>
              <span className={styles.logoText}>{t('common.appName')}</span>
            </RouterLink>

            <nav className={styles.nav} aria-label="Main navigation">
              <a
                href={location.pathname === '/' ? '#how-it-works' : '/#how-it-works'}
                className={styles.headerNavLink}
                onClick={(e) => {
                  if (location.pathname === '/') {
                    e.preventDefault();
                    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                  }
                  setMobileOpen(false);
                }}
              >
                Product
              </a>
              <HeaderNavLink to="/pricing" label={t('header.pricing')} icon="💰" exact />
            </nav>

            <div className={styles.actions}>
              <div className={styles.langWrap}>
                <LanguageDropdown />
              </div>
              <div className={styles.authWrap}>
                <RouterLink to="/login" className={styles.loginBtn}>
                  {t('header.login')}
                </RouterLink>
                <RouterLink
                  to="/signup"
                  className={styles.signupBtn}
                  onClick={(e) => {
                    e.preventDefault();
                    openEntryFlow();
                  }}
                >
                  {t('header.signup')}
                </RouterLink>
              </div>
            </div>

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
          </>
        ) : (
          <>
            <div className={styles.signedLeft}>
              <RouterLink className={styles.logoCompact} to="/app/discover" aria-label={t('common.appName')}>
                <span className={styles.logoIcon}>⚡</span>
                <span className={styles.logoText}>{t('common.appName')}</span>
              </RouterLink>
              <nav className={styles.navApp} aria-label="App">
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
            </div>

            <div className={styles.statusCenter} aria-live="polite">
              <span className={styles.statusText}>{statusLine}</span>
            </div>

            <div className={styles.signedRight}>
              <div className={styles.langMuted} title="Language">
                <LanguageDropdown />
              </div>
              <span className={styles.headerCredits} title="Credits">
                <span className={styles.headerCreditsVal}>{credits}</span>
                <span className={styles.headerCreditsSep}>/</span>
                <span className={styles.headerCreditsMax}>{creditCap}</span>
              </span>
              <RouterLink
                to="/pricing"
                className={`${styles.upgradeBtn} ${lowCredits ? styles.upgradeBtnUrgent : ''}`}
                onClick={() => analytics.pricingOpened('header')}
              >
                Get Credits
              </RouterLink>
              <div className={`${styles.userWrap} ${userOpen ? styles.userOpen : ''}`} ref={userRef}>
                <button
                  type="button"
                  className={styles.avatarBtn}
                  onClick={() => setUserOpen(!userOpen)}
                  aria-expanded={userOpen}
                  aria-haspopup="true"
                  aria-label={`${me?.profile?.name || user?.email || 'User'} menu`}
                >
                  <span className={styles.avatarCircle}>{avatarLetter}</span>
                  {!profileComplete && <span className={styles.badge} aria-label="Profile incomplete">!</span>}
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
            </div>

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
          </>
        )}
      </div>

      {mobileOpen && (
        <>
          <div className={styles.overlay} onClick={() => setMobileOpen(false)} aria-hidden />
          <div className={styles.mobileMenu}>
            <nav className={styles.mobileNav}>
              {!isLoggedIn ? (
                <>
                  <a
                    href={location.pathname === '/' ? '#how-it-works' : '/#how-it-works'}
                    className={styles.mobileLink}
                    onClick={(e) => {
                      if (location.pathname === '/') {
                        e.preventDefault();
                        document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                      }
                      setMobileOpen(false);
                    }}
                  >
                    Product
                  </a>
                  <RouterLink to="/pricing" className={styles.mobileLink} onClick={() => setMobileOpen(false)}>
                    💰 {t('header.pricing')}
                  </RouterLink>
                </>
              ) : (
                <>
                  <div className={styles.mobileStatus}>
                    {statusLine}
                  </div>
                  {navItems.map(({ label, href }) => (
                    <RouterLink key={href} to={href} className={styles.mobileLink} onClick={() => setMobileOpen(false)}>
                      {label}
                    </RouterLink>
                  ))}
                </>
              )}
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
                  <span
                    className={styles.mobileCredits}
                    title={`${credits} of ${creditCap} credits`}
                    aria-label={`${credits} of ${creditCap} credits`}
                  >
                    {credits}/{creditCap} credits
                  </span>
                  <RouterLink
                    to="/pricing"
                    className={`${styles.mobileUpgrade} ${lowCredits ? styles.mobileUpgradeUrgent : ''}`}
                    onClick={() => {
                      setMobileOpen(false);
                      analytics.pricingOpened('mobile');
                    }}
                  >
                    Get Credits
                  </RouterLink>
                  <RouterLink to="/app/profile" className={styles.mobileLink} onClick={() => setMobileOpen(false)}>
                    {t('header.profile')}
                  </RouterLink>
                  <button type="button" className={styles.mobileLogout} onClick={handleLogout}>
                    {t('common.logout')}
                  </button>
                </>
              ) : (
                <>
                  <RouterLink to="/login" className={styles.mobileLink} onClick={() => setMobileOpen(false)}>
                    {t('header.login')}
                  </RouterLink>
                  <RouterLink
                    to="/signup"
                    className={styles.mobileSignup}
                    onClick={(e) => {
                      e.preventDefault();
                      setMobileOpen(false);
                      openEntryFlow();
                    }}
                  >
                    {t('header.signup')}
                  </RouterLink>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </header>
  );
};
