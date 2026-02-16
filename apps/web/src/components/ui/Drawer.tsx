import React from 'react';
import styles from './Drawer.module.css';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  anchor?: 'left' | 'right' | 'bottom';
}

export const Drawer: React.FC<DrawerProps> = ({
  open,
  onClose,
  title,
  children,
  anchor = 'right',
}) => {
  if (!open) return null;
  return (
    <>
      <div
        className={styles.backdrop}
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        role="button"
        tabIndex={0}
        aria-label="Close drawer"
      />
      <aside
        className={`${styles.drawer} ${styles[anchor]}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'drawer-title' : undefined}
      >
        {title && (
          <div className={styles.header}>
            <h2 id="drawer-title" className={styles.title}>{title}</h2>
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
        )}
        <div className={styles.content}>{children}</div>
      </aside>
    </>
  );
};
