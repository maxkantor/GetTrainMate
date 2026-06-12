import React from 'react';
import { Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { useI18n } from '@/hooks/useI18n';
import { setAuthReturn } from '@/utils/authReturn';
import styles from '@/pages/EventHub.module.css';

type Props = {
  open: boolean;
  onClose: () => void;
  returnPath?: string;
};

export const WcAuthGateModal: React.FC<Props> = ({ open, onClose, returnPath = '/world-cup#predict' }) => {
  const { t } = useI18n();

  const go = (path: string) => {
    setAuthReturn(returnPath);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={t('event_hub.auth_modal_title')}>
      <Typography className={styles.modalCopy}>{t('event_hub.auth_modal_copy')}</Typography>
      <Typography className={styles.modalTrust}>{t('event_hub.trust_line')}</Typography>
      <Stack spacing={1.25} sx={{ mt: 2.5 }}>
        <Button
          variant="contained"
          size="large"
          className={styles.ctaPrimary}
          component={RouterLink}
          to={`/signup?return=${encodeURIComponent(returnPath)}`}
          onClick={() => go('/signup')}
        >
          {t('event_hub.signup_free')}
        </Button>
        <Button
          variant="outlined"
          size="large"
          className={styles.ctaSecondary}
          component={RouterLink}
          to={`/login?return=${encodeURIComponent(returnPath)}`}
          onClick={() => go('/login')}
        >
          {t('event_hub.login_existing')}
        </Button>
      </Stack>
    </Modal>
  );
};
