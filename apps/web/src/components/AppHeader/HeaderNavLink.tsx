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
  /** Unread count badge (e.g. chat). */
  badgeCount?: number;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}

export const HeaderNavLink: React.FC<HeaderNavLinkProps> = ({
  to,
  label,
  icon,
  exact = false,
  alsoActiveOnPaths,
  badgeCount,
  onClick,
}) => {
  const location = useLocation();
  const extraActive =
    alsoActiveOnPaths?.some((p) => matchPath({ path: p, end: true }, location.pathname)) ?? false;

  return (
    <NavLink
      to={to}
      end={exact}
      onClick={onClick}
      className={({ isActive }) =>
        `${styles.headerNavLink} ${isActive || extraActive ? styles.headerNavLinkActive : ''}`
      }
    >
      {icon != null && <span className={styles.headerNavLinkIcon} aria-hidden>{icon}</span>}
      <span className={styles.headerNavLinkLabel}>{label}</span>
      {typeof badgeCount === 'number' && badgeCount > 0 && (
        <span className={styles.navBadge} aria-label={`${badgeCount} unread`}>
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      )}
    </NavLink>
  );
};
