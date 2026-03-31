import React from 'react';
import { useLocation } from 'react-router-dom';
import { AppHeader } from './AppHeader/AppHeader';
import { Footer } from './layout/Footer';
import styles from './Layout.module.css';

interface LayoutProps {
  children: React.ReactNode;
}

/** True when on any /app/* route (authenticated app shell). */
function isAppRoute(pathname: string): boolean {
  return pathname.startsWith('/app');
}

/** True when on landing page (hero full-bleed, immersive nav). */
export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { pathname } = useLocation();
  const isApp = isAppRoute(pathname);

  return (
    <div className={styles.wrapper}>
      <AppHeader />
      <main className={isApp ? styles.mainApp : styles.main}>
        {isApp ? <div className={styles.appContainer}>{children}</div> : children}
      </main>
      {/* Full marketing footer on every route (including /app/*); brand links home */}
      <Footer />
    </div>
  );
};
