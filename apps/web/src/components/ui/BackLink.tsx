import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/hooks/useI18n';
import styles from './BackLink.module.css';

interface BackLinkProps {
  /** Optional label. Defaults to localized common.back */
  label?: string;
}

export const BackLink: React.FC<BackLinkProps> = ({ label }) => {
  const { t } = useI18n();
  const text = label ?? t('common.back');
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
      aria-label={text}
    >
      ← {text}
    </a>
  );
};
