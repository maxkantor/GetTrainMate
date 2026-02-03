import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useI18n } from '@/hooks/useI18n';
import { useAuthContext } from '@/hooks/useAuthContext';
import { billingService, CreditsBalanceDto } from '@/services/billingService';
import { authService } from '@/services/authService';

export const SubscriptionPage: React.FC = () => {
  const { t } = useI18n();
  const { user } = useAuthContext();
  const [balance, setBalance] = useState<CreditsBalanceDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const token = await authService.getJWT();
        if (!token) {
          setError('Not authenticated');
          return;
        }
        const b = await billingService.getCreditsBalance(token);
        setBalance(b);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load balance');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
        Credits &amp; Billing
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {balance !== null && (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Current balance
            </Typography>
            <Typography variant="h4" component="p" sx={{ mb: 1 }}>
              {balance.balance} credits
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Lifetime earned: {balance.lifetimeEarned} credits
            </Typography>
          </CardContent>
        </Card>
      )}

      <Box>
        <Button variant="contained" href="/pricing" color="primary">
          Get more credits
        </Button>
      </Box>
    </Container>
  );
};
