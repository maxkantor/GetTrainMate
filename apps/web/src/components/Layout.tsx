import React from 'react';
import { useLocation } from 'react-router-dom';
import { AppHeader } from './AppHeader/AppHeader';
import { Footer } from './layout/Footer';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useActivityHeartbeat } from '@/hooks/useActivityHeartbeat';
import { ChatPresenceProvider } from '@/contexts/ChatPresenceContext';
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

  return (
    <div className={styles.wrapper}>
      <ChatPresenceProvider>
        {user && isApp && !isAdmin && <AppActivityHeartbeat />}
        {!isAdmin && <AppHeader />}
        <main className={isApp && !isAdmin ? styles.mainApp : styles.main}>
          {isApp && !isAdmin ? <div className={styles.appContainer}>{children}</div> : children}
        </main>
      </ChatPresenceProvider>
      {!isAdmin && <Footer />}
    </div>
  );
};

