import React from 'react';
import styles from './Button.module.css';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  className?: string;
  style?: React.CSSProperties;
  as?: 'button' | 'a';
  href?: string;
  target?: string;
  rel?: string;
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  as = 'button',
  className = '',
  style,
  href,
  target,
  rel,
  onClick,
  disabled,
  type = 'button',
}) => {
  const classNames = `${styles.button} ${styles[variant]} ${styles[size]} ${fullWidth ? styles.fullWidth : ''} ${className}`;
  
  if (as === 'a' && href) {
    return (
      <a 
        href={href} 
        target={target} 
        rel={rel} 
        className={classNames}
        style={style}
        onClick={onClick}
      >
        {children}
      </a>
    );
  }
  
  return (
    <button 
      className={classNames} 
      style={style}
      onClick={onClick}
      disabled={disabled}
      type={type}
    >
      {children}
    </button>
  );
};
