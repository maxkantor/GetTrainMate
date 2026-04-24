import React from 'react';
import { useI18n } from '@/hooks/useI18n';
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
  title,
  body,
  confirmLabel,
}) => {
  const { t } = useI18n();
  if (!open) return null;

  const resolvedTitle = title ?? t('connect_modal.title');
  const resolvedBody = body ?? t('connect_modal.body');
  const resolvedConfirm = confirmLabel ?? t('connect_modal.confirm');

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
          {resolvedTitle}
        </h2>
        <p className={styles.body}>{resolvedBody}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onClose}
            disabled={loading}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className={styles.confirmBtn}
            onClick={onConfirm}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? t('common.loading') : resolvedConfirm}
          </button>
        </div>
      </div>
    </div>
  );
};
