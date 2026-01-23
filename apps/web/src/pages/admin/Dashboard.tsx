import React from 'react';
import { Container, Typography } from '@mui/material';
import { useI18n } from '@/hooks/useI18n';

export const AdminDashboard: React.FC = () => {
  const { t } = useI18n();

  return (
    <Container maxWidth="lg" sx={{ py: 8 }}>
      <Typography variant="h3" component="h1" gutterBottom>
        {t('admin.dashboard')}
      </Typography>
      <Typography variant="body1" color="textSecondary">
        Admin panel coming soon...
      </Typography>
    </Container>
  );
};
