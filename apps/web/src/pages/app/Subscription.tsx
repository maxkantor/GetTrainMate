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
import { paymentService, SubscriptionStatus } from '@/services/paymentService';
import { authService } from '@/services/authService';

interface PricingPlan {
  id: 'premium_monthly' | 'premium_yearly' | 'lifetime';
  name: string;
  price: number;
  billing: string;
  features: string[];
  featured?: boolean;
}

const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'premium_monthly',
    name: 'Premium Monthly',
    price: 9.99,
    billing: '/month',
    features: [
      'Unlimited matches',
      'Advanced filters',
      'Message history',
      'Event creation',
      'Priority support',
    ],
  },
  {
    id: 'premium_yearly',
    name: 'Premium Yearly',
    price: 89.99,
    billing: '/year',
    features: [
      'Everything in Monthly',
      'Save 25% vs monthly',
      'Priority matching',
      'Custom profile',
      'Analytics dashboard',
    ],
    featured: true,
  },
  {
    id: 'lifetime',
    name: 'Lifetime Access',
    price: 199.99,
    billing: 'one-time',
    features: [
      'Everything forever',
      'No recurring charges',
      'VIP status',
      'Early feature access',
      'Premium support',
    ],
  },
];

export const SubscriptionPage: React.FC = () => {
  const { t } = useI18n();
  const { user } = useAuthContext();

  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);

  useEffect(() => {
    loadSubscriptionStatus();
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

      const status = await paymentService.getSubscriptionStatus(token);
      setSubscription(status);
    } catch (err: any) {
      console.error('Error loading subscription:', err);
      setError(err.message || 'Failed to load subscription status');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planId: 'premium_monthly' | 'premium_yearly' | 'lifetime') => {
    try {
      setProcessingPlan(planId);
      setError('');
      const token = await authService.getJWT();
      if (!token) return;

      // Skip payment for demo (in production, this would redirect to Stripe)
      console.log(`Upgrading to ${planId}`);
      
      // For demo purposes, show success message
      Alert;
      setProcessingPlan(null);
    } catch (err: any) {
      console.error('Error processing upgrade:', err);
      setError(err.message || 'Failed to process upgrade');
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
                      <Chip label={subscription.planType} color="primary" />
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

                  {subscription?.isPremium && subscription.planType === plan.id ? (
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
                      {processingPlan === plan.id ? 'Processing...' : 'Upgrade'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Payment History */}
      {subscription && subscription.recentPayments.length > 0 && (
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
