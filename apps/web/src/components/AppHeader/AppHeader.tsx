import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link as RouterLink, useNavigate, useLocation, matchPath } from 'react-router-dom';
import { Tooltip, Box, Typography } from '@mui/material';
import { useI18n } from '@/hooks/useI18n';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useMe } from '@/hooks/useMe';
import { analytics } from '@/utils/analytics';
import { LanguageDropdown } from '@/components/layout/LanguageDropdown';
import { HeaderNavLink } from './HeaderNavLink';
import { useLandingConversion } from '@/contexts/LandingConversionContext';
import { useMatchStatusForHeader } from '@/hooks/useMatchStatusForHeader';
import { DAILY_LIKE_LIMIT } from '@/config/appLimits';
import { useChatUnreadCount } from '@/hooks/useChatUnreadCount';
import { requestChatNavScrollTop } from '@/utils/chatNav';
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
  const chatUnread = useChatUnreadCount();

  const credits = me?.credits ?? 0;
  const creditCap = Math.max(me?.lifetimeEarned ?? 0, credits);
  const lowCredits = credits <= 1;
  const likesToday = matchStatus.likesToday;
  const outOfFreeSwipes = likesToday >= DAILY_LIKE_LIMIT;
  const blockedOnDiscover = outOfFreeSwipes && credits < 1;
  const pressureCredits = lowCredits || blockedOnDiscover;

  /** Status between nav and credits — never repeat balance (shown in credit pill + tooltip). */
  const centerStatus = useMemo(() => {
    if (matchStatus.loading) return '';
    if (matchStatus.waitingForAction > 0) {
      return `${matchStatus.waitingForAction} match${matchStatus.waitingForAction === 1 ? '' : 'es'} waiting`;
    }
    if (blockedOnDiscover) {
      return 'No free likes left today — add credits or try after midnight UTC.';
    }
    const used = Math.min(likesToday, DAILY_LIKE_LIMIT);
    if (credits === 0) {
      return `${used}/${DAILY_LIKE_LIMIT} free send-interests left today`;
    }
    if (me?.unlimitedDiscovery) {
      return 'Unlimited browsing';
    }
    return '';
  }, [
    matchStatus.loading,
    matchStatus.waitingForAction,
    blockedOnDiscover,
    likesToday,
    credits,
    me?.unlimitedDiscovery,
  ]);

  const creditTooltip = useMemo(
    () => (
      <Box component="div" role="presentation" sx={{ py: 0.5, px: 0.25, maxWidth: 280 }}>
        <Typography variant="caption" component="div" sx={{ display: 'block', fontWeight: 700, mb: 0.75 }}>
          {credits} remaining out of {creditCap} total credits
        </Typography>
        <Typography variant="caption" component="div" sx={{ display: 'block', opacity: 0.92, lineHeight: 1.45 }}>
          1 credit per send-interest
        </Typography>
        <Typography variant="caption" component="div" sx={{ display: 'block', opacity: 0.92, lineHeight: 1.45, mt: 0.5 }}>
          AI Icebreaker: 1 credit
        </Typography>
      </Box>
    ),
    [credits, creditCap]
  );

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

  const appNavItems: {
    label: string;
    href: string;
    icon?: string;
    exact?: boolean;
    alsoActiveOnPaths?: string[];
  }[] = useMemo(() => {
    const items: {
      label: string;
      href: string;
      icon?: string;
      exact?: boolean;
      alsoActiveOnPaths?: string[];
    }[] = [
      { label: t('nav.discover'), href: '/app/discover', exact: true },
      { label: t('nav.match'), href: '/app/matches' },
    ];
    if (me?.profile?.discoverCanReviewLikedProfiles !== false) {
      items.push({ label: 'Sent', href: '/app/sent-requests' });
    }
    if (me?.profile?.discoverCanReviewSkippedProfiles !== false) {
      items.push({ label: 'Skipped', href: '/app/skipped' });
    }
    items.push(
      { label: t('nav.chat'), href: '/app/chat' },
      { label: t('nav.events'), href: '/app/events' },
      { label: t('nav.profile'), href: '/app/profile' },
      { label: 'AI Coach', href: '/app/ai-coach' }
    );
    return items;
  }, [me?.profile, t]);

  const isAppNavItemActive = (
    pathname: string,
    to: string,
    opts?: { exact?: boolean; alsoActiveOnPaths?: string[] }
  ) => {
    const exact = opts?.exact ?? false;
    if (matchPath({ path: to, end: exact }, pathname)) return true;
    return opts?.alsoActiveOnPaths?.some((p) => matchPath({ path: p, end: true }, pathname)) ?? false;
  };

  const loggedInNav = appNavItems;
  const navItems = isLoggedIn ? loggedInNav : [];
  const logoTo = '/';

  /** Product → landing “See How Matching Works” (#how-it-works on SwipeDemoSection). */
  const handleProductNav = (e: React.MouseEvent) => {
    e.preventDefault();
    setMobileOpen(false);
    if (location.pathname === '/') {
      document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
      window.history.replaceState(null, '', '#how-it-works');
    } else {
      navigate({ pathname: '/', hash: 'how-it-works' });
    }
  };

  const handleLogoClick = (e: React.MouseEvent) => {
    setMobileOpen(false);
    if (location.pathname === '/') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (location.hash) {
        window.history.replaceState(null, '', '/');
      }
    }
  };

  return (
    <header className={styles.root}>
      <div className={styles.inner}>
        {!isLoggedIn ? (
          <>
            <RouterLink
              to={logoTo}
              className={styles.logo}
              aria-label={t('common.appName')}
              onClick={handleLogoClick}
            >
              <span className={styles.logoIcon}>⚡</span>
              <span className={styles.logoText}>{t('common.appName')}</span>
            </RouterLink>

            <nav className={styles.nav} aria-label="Main navigation">
              <a
                href="/#how-it-works"
                className={styles.headerNavLink}
                onClick={handleProductNav}
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
              <RouterLink
                className={styles.logoCompact}
                to="/app"
                aria-label={`${t('common.appName')} — dashboard`}
              >
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
                    alsoActiveOnPaths={item.alsoActiveOnPaths}
                    badgeCount={item.href === '/app/chat' ? chatUnread : undefined}
                    onClick={item.href === '/app/chat' ? () => requestChatNavScrollTop() : undefined}
                  />
                ))}
              </nav>
            </div>

            {centerStatus ? (
              <div className={styles.statusCenter} aria-live="polite">
                <span className={styles.statusText}>{centerStatus}</span>
              </div>
            ) : (
              <div className={styles.statusCenterSpacer} aria-hidden />
            )}

            <div className={styles.signedRight}>
              <div className={styles.langWrap} title="Language">
                <LanguageDropdown />
              </div>
              <Tooltip title={creditTooltip} arrow enterTouchDelay={0} placement="bottom">
                <span
                  className={styles.headerCredits}
                  aria-label={`${credits} remaining out of ${creditCap} total credits. 1 credit per send-interest. AI Icebreaker 1 credit.`}
                >
                  <span className={styles.headerCreditsVerbose}>
                    <span className={styles.headerCreditsVal}>{credits}</span>
                    <span className={styles.headerCreditsSep}> / </span>
                    <span className={styles.headerCreditsMax}>{creditCap}</span>
                    <span className={styles.headerCreditsWord}> credits</span>
                  </span>
                  <span className={styles.headerCreditsTight} aria-hidden>
                    {credits}/{creditCap} credits
                  </span>
                </span>
              </Tooltip>
              <RouterLink
                to="/pricing"
                className={`${styles.upgradeBtn} ${pressureCredits ? styles.upgradeBtnUrgent : ''}`}
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
                  <a href="/#how-it-works" className={styles.mobileLink} onClick={handleProductNav}>
                    Product
                  </a>
                  <RouterLink to="/pricing" className={styles.mobileLink} onClick={() => setMobileOpen(false)}>
                    💰 {t('header.pricing')}
                  </RouterLink>
                </>
              ) : (
                <>
                  {centerStatus ? (
                    <div className={styles.mobileStatus}>{centerStatus}</div>
                  ) : null}
                  {navItems.map(({ label, href, exact, alsoActiveOnPaths }) => {
                    const navActive = isAppNavItemActive(location.pathname, href, { exact, alsoActiveOnPaths });
                    return (
                      <RouterLink
                        key={href}
                        to={href}
                        className={`${styles.mobileLink} ${navActive ? styles.mobileLinkActive : ''}`}
                        onClick={() => {
                          setMobileOpen(false);
                          if (href === '/app/chat') requestChatNavScrollTop();
                        }}
                      >
                        {label}
                      </RouterLink>
                    );
                  })}
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
                  <Tooltip title={creditTooltip} arrow enterTouchDelay={0}>
                    <span
                      className={styles.mobileCredits}
                      aria-label={`${credits} remaining out of ${creditCap} total credits`}
                    >
                      <span className={styles.headerCreditsVerbose}>
                        <span className={styles.headerCreditsVal}>{credits}</span>
                        <span className={styles.headerCreditsSep}> / </span>
                        <span className={styles.headerCreditsMax}>{creditCap}</span>
                        <span className={styles.headerCreditsWord}> credits</span>
                      </span>
                      <span className={styles.headerCreditsTight} aria-hidden>
                        {credits}/{creditCap} credits
                      </span>
                    </span>
                  </Tooltip>
                  <RouterLink
                    to="/pricing"
                    className={`${styles.mobileUpgrade} ${pressureCredits ? styles.mobileUpgradeUrgent : ''}`}
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
