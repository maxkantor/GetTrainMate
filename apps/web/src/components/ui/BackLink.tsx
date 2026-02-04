import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './BackLink.module.css';

interface BackLinkProps {
  /** Optional label. Default: "Back" */
  label?: string;
}

export const BackLink: React.FC<BackLinkProps> = ({ label = 'Back' }) => {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const fallbackHref = '/';
  return (
    <a
      href={fallbackHref}
      className={styles.backLink}
      onClick={handleClick}
      aria-label={label}
    >
      ← {label}
    </a>
  );
};
