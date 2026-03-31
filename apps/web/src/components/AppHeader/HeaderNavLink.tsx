import React from 'react';
import { NavLink, useLocation, matchPath } from 'react-router-dom';
import styles from './AppHeader.module.css';

interface HeaderNavLinkProps {
  to: string;
  label: string;
  icon?: React.ReactNode;
  exact?: boolean;
  /** Treat these paths as active (e.g. Discover tab also active on `/app` index). */
  alsoActiveOnPaths?: string[];
}

export const HeaderNavLink: React.FC<HeaderNavLinkProps> = ({
  to,
  label,
  icon,
  exact = false,
  alsoActiveOnPaths,
}) => {
  const location = useLocation();
  const extraActive =
    alsoActiveOnPaths?.some((p) => matchPath({ path: p, end: true }, location.pathname)) ?? false;

  return (
    <NavLink
      to={to}
      end={exact}
      className={({ isActive }) =>
        `${styles.headerNavLink} ${isActive || extraActive ? styles.headerNavLinkActive : ''}`
      }
    >
      {icon != null && <span className={styles.headerNavLinkIcon} aria-hidden>{icon}</span>}
      {label}
    </NavLink>
  );
};
