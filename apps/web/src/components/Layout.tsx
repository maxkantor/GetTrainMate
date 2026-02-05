import React from 'react';
import { AppHeader } from './AppHeader/AppHeader';
import { Footer } from './layout/Footer';
import styles from './Layout.module.css';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className={styles.wrapper}>
      <AppHeader />
      <main className={styles.main}>
        {children}
      </main>
      <Footer />
    </div>
  );
};
