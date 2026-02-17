import React from 'react';
import FilterListIcon from '@mui/icons-material/FilterList';
import styles from './FiltersButton.module.css';

interface FiltersButtonProps {
  onClick: () => void;
  activeCount: number;
  'aria-label'?: string;
}

export const FiltersButton: React.FC<FiltersButtonProps> = ({
  onClick,
  activeCount,
  'aria-label': ariaLabel = 'Open filters',
}) => {
  return (
    <button
      type="button"
      className={styles.btn}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <FilterListIcon className={styles.icon} aria-hidden />
      <span>
        Filters
        {activeCount > 0 && (
          <span className={styles.badge} aria-label={`${activeCount} filters active`}>
            ({activeCount})
          </span>
        )}
      </span>
    </button>
  );
};
