import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Typography,
  Grid,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import { useI18n } from '@/hooks/useI18n';
import { useAuthContext } from '@/hooks/useAuthContext';
import { billingService, SubscriptionStatusDto } from '@/services/billingService';
import { authService } from '@/services/authService';

interface PricingPlan {
  id: 'free' | 'pro' | 'elite';
  name: string;
  price: number;
  billing: string;
  features: string[];
  featured?: boolean;
}

const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    billing: '/month',
    features: [
      '10 matches per day',
      '5 messages per day',
      'Basic filters',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 5.99,
    billing: '/month',
    features: [
      'Unlimited matches',
      'Unlimited messaging',
      'Advanced filters',
      'AI compatibility',
      'See who liked you',
    ],
  },
  {
    id: 'elite',
    name: 'Elite',
    price: 9.99,
    billing: '/month',
    features: [
      'Everything in Pro',
      'Priority placement',
    ],
    featured: true,
  },
];

export const SubscriptionPage: React.FC = () => {
  const { t } = useI18n();
  const { user } = useAuthContext();

  const [subscription, setSubscription] = useState<SubscriptionStatusDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);

  useEffect(() => {
    loadSubscriptionStatus();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true' || params.get('canceled') === 'true') {
      window.history.replaceState({}, '', '/app/subscription');
      loadSubscriptionStatus();
    }
  }, []);

  const loadSubscriptionStatus = async () => {
    try {
      setLoading(true);
      setError('');
      const token = await authService.getJWT();
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const status = await billingService.getSubscriptionStatus(token);
      setSubscription(status);
    } catch (err: any) {
      console.error('Error loading subscription:', err);
      setError(err.message || 'Failed to load subscription status');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planId: 'free' | 'pro' | 'elite') => {
    if (planId === 'free') {
      window.location.href = '/app/discover';
      return;
    }
    try {
      setProcessingPlan(planId);
      setError('');
      const token = await authService.getJWT();
      if (!token) return;

      const url = await billingService.createCheckoutSession(token, planId);
      window.location.href = url;
    } catch (err: any) {
      console.error('Error processing upgrade:', err);
      setError(err.response?.data?.error || err.message || 'Failed to start checkout');
      setProcessingPlan(null);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      {/* Current Status */}
      {subscription && (
        <Box sx={{ mb: 6 }}>
          <Typography variant="h5" gutterBottom sx={{ mb: 2 }}>
            Current Plan
          </Typography>
          <Card>
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Typography color="textSecondary" gutterBottom>
                    Status
                  </Typography>
                  <Typography variant="h6">
                    {subscription.isPremium ? (
                      <Chip label={subscription.planKey} color="primary" />
                    ) : (
                      <Chip label="Free" variant="outlined" />
                    )}
                  </Typography>
                </Grid>
                {subscription.isPremium && subscription.expiresAt && (
                  <Grid item xs={12} sm={6}>
                    <Typography color="textSecondary" gutterBottom>
                      Expires At
                    </Typography>
                    <Typography variant="h6">
                      {new Date(subscription.expiresAt).toLocaleDateString()}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Pricing Plans */}
      <Box sx={{ mb: 6 }}>
        <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
          Upgrade Your Plan
        </Typography>
        <Grid container spacing={3}>
          {PRICING_PLANS.map((plan) => (
            <Grid item xs={12} sm={6} md={4} key={plan.id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  border: plan.featured ? '2px solid' : '1px solid #e0e0e0',
                  borderColor: plan.featured ? 'primary.main' : 'divider',
                  transform: plan.featured ? 'scale(1.05)' : 'scale(1)',
                  position: 'relative',
                }}
              >
                {plan.featured && (
                  <Box sx={{
                    position: 'absolute',
                    top: -15,
                    left: '50%',
                    transform: 'translateX(-50%)',
                  }}>
                    <Chip label="Most Popular" color="primary" />
                  </Box>
                )}
                <CardContent sx={{ flex: 1 }}>
                  <Typography variant="h6" gutterBottom>
                    {plan.name}
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="h4" component="span">
                      ${plan.price.toFixed(2)}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" component="span">
                      {plan.billing}
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    {plan.features.map((feature, idx) => (
                      <Typography key={idx} variant="body2" sx={{ mb: 1 }}>
                        ✓ {feature}
                      </Typography>
                    ))}
                  </Box>

                  {plan.id === 'free' ? (
                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={() => handleUpgrade('free')}
                    >
                      Use Free
                    </Button>
                  ) : subscription?.isPremium && (subscription.planKey === plan.id || (plan.id === 'elite' && ['premium', 'premium_monthly', 'premium_yearly', 'lifetime'].includes(subscription.planKey))) ? (
                    <Button fullWidth variant="outlined" disabled>
                      Current Plan
                    </Button>
                  ) : (
                    <Button
                      fullWidth
                      variant={plan.featured ? 'contained' : 'outlined'}
                      color="primary"
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={processingPlan !== null}
                    >
                      {processingPlan === plan.id ? 'Redirecting…' : plan.id === 'pro' ? 'Upgrade to Pro' : 'Go Elite'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Payment History */}
      {subscription && subscription.recentPayments && subscription.recentPayments.length > 0 && (
        <Box>
          <Typography variant="h5" gutterBottom sx={{ mb: 2 }}>
            Payment History
          </Typography>
          <Card>
            <CardContent>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Plan</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {subscription.recentPayments.map((payment) => (
                    <TableRow key={payment.paymentId}>
                      <TableCell>
                        {new Date(payment.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{payment.planType}</TableCell>
                      <TableCell align="right">${payment.amount.toFixed(2)}</TableCell>
                      <TableCell>
                        <Chip
                          label={payment.status}
                          size="small"
                          color={payment.status === 'completed' ? 'success' : 'default'}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Box>
      )}
    </Container>
  );
};
