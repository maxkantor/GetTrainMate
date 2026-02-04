import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { AppHeader, type HeaderVariant } from './AppHeader/AppHeader';
import { Footer } from './layout/Footer';
import styles from './Layout.module.css';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { pathname } = useLocation();
  const { user } = useAuthContext();
  const hideFooter = pathname === '/pricing';
  const variant: HeaderVariant = pathname === '/' ? 'hero' : 'solid';

  return (
    <div className={styles.wrapper}>
      <AppHeader variant={variant} />
      <main className={styles.main}>
        {children}
      </main>
      {!hideFooter && <Footer />}
    </div>
  );
};
