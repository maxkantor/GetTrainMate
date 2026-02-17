import React from 'react';
import styles from './ConfirmConnectModal.module.css';

interface ConfirmConnectModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  title?: string;
  body?: string;
  confirmLabel?: string;
}

export const ConfirmConnectModal: React.FC<ConfirmConnectModalProps> = ({
  open,
  onClose,
  onConfirm,
  loading,
  title = 'Priority Connect',
  body = 'View their full profile and start a conversation. Unlocking chat costs 1 credit when you match.',
  confirmLabel = 'View Profile',
}) => {
  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      onClick={onClose}
      role="presentation"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="connect-modal-title" className={styles.title}>
          {title}
        </h2>
        <p className={styles.body}>{body}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.confirmBtn}
            onClick={onConfirm}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? 'Loading…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
