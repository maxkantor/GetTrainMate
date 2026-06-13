import React from 'react';
import { useLocation } from 'react-router-dom';
import { AppHeader } from './AppHeader/AppHeader';
import { AppBottomNav } from './layout/AppBottomNav';
import { Footer } from './layout/Footer';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useActivityHeartbeat } from '@/hooks/useActivityHeartbeat';
import { ChatPresenceProvider } from '@/contexts/ChatPresenceContext';
import { CreditsUsageModalProvider } from '@/contexts/CreditsUsageModalContext';
import styles from './Layout.module.css';

function AppActivityHeartbeat() {
  useActivityHeartbeat();
  return null;
}

interface LayoutProps {
  children: React.ReactNode;
}

/** True when on any /app/* route (authenticated app shell). */
function isAppRoute(pathname: string): boolean {
  return pathname.startsWith('/app');
}

/** World Cup hub pages use their own soccer cinematic backdrop. */
function isSoccerRoute(pathname: string): boolean {
  if (pathname === '/world-cup' || pathname.startsWith('/world-cup/')) return true;
  if (pathname.startsWith('/events/') && pathname.includes('world-cup')) return true;
  return false;
}

/** Admin CRM uses its own AppBar + sidebar; skip global marketing header/footer. */
function isAdminRoute(pathname: string): boolean {
  return pathname.startsWith('/admin');
}

/** True when on landing page (hero full-bleed, immersive nav). */
export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { pathname } = useLocation();
  const isApp = isAppRoute(pathname);
  const isAdmin = isAdminRoute(pathname);
  const { user } = useAuthContext();
  const showAppShell = isApp && !isAdmin;
  const showLoggedInHero = Boolean(user) && !isAdmin && !isSoccerRoute(pathname);
  const appShellClassName = showAppShell
    ? `${styles.mainApp} ${user ? styles.mainAppWithBottomNav : ''} ${showLoggedInHero ? 'app-hero-bg app-auth-bg' : 'premium-page-bg'}`
    : showLoggedInHero
      ? `${styles.main} app-hero-bg app-auth-bg`
      : styles.main;

  return (
    <div className={styles.wrapper}>
      <ChatPresenceProvider>
        <CreditsUsageModalProvider>
          {user && showAppShell && <AppActivityHeartbeat />}
          {!isAdmin && <AppHeader />}
          <main className={appShellClassName}>
            {showAppShell ? <div className={styles.appContainer}>{children}</div> : children}
          </main>
          {showAppShell && user ? <AppBottomNav /> : null}
        </CreditsUsageModalProvider>
      </ChatPresenceProvider>
      {!isAdmin && <Footer compact={showAppShell} hideOnMobileApp={showAppShell && !!user} />}
    </div>
  );
};

