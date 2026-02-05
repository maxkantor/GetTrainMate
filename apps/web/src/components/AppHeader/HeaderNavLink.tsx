import React from 'react';
import { NavLink } from 'react-router-dom';
import styles from './AppHeader.module.css';

interface HeaderNavLinkProps {
  to: string;
  label: string;
  icon?: React.ReactNode;
  exact?: boolean;
}

export const HeaderNavLink: React.FC<HeaderNavLinkProps> = ({
  to,
  label,
  icon,
  exact = false,
}) => {
  return (
    <NavLink
      to={to}
      end={exact}
      className={({ isActive }) =>
        `${styles.headerNavLink} ${isActive ? styles.headerNavLinkActive : ''}`
      }
    >
      {icon != null && <span className={styles.headerNavLinkIcon} aria-hidden>{icon}</span>}
      {label}
    </NavLink>
  );
};
