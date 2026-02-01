import React from 'react';
import { useLocation } from 'react-router-dom';
import { Header } from './layout/Header';
import { Footer } from './layout/Footer';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { pathname } = useLocation();
  const hideFooter = pathname === '/pricing';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        {children}
      </main>
      {!hideFooter && <Footer />}
    </div>
  );
};
