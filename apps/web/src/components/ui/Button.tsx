import React from 'react';
import { Link } from 'react-router-dom';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
  as?: 'button' | 'link' | 'a';
  to?: string;
  href?: string;
  target?: string;
  rel?: string;
  className?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
  onClick?: () => void;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth,
  loading,
  as = 'button',
  to,
  href,
  target,
  rel,
  className = '',
  children,
  disabled,
  style,
  onClick,
}) => {
  const classes = [
    styles.btn,
    styles[variant],
    styles[size],
    fullWidth && styles.fullWidth,
    loading && styles.loading,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (as === 'link' && to) {
    return (
      <Link to={to} className={classes} style={style}>
        {loading ? <span className={styles.spinner} /> : children}
      </Link>
    );
  }

  if (as === 'a' && href) {
    return (
      <a href={href} className={classes} target={target} rel={rel} style={style} onClick={onClick}>
        {loading ? <span className={styles.spinner} /> : children}
      </a>
    );
  }

  return (
    <button type="button" className={classes} disabled={disabled || loading} onClick={onClick}>
      {loading ? <span className={styles.spinner} /> : children}
    </button>
  );
};
