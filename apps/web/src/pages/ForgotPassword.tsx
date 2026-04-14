import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Box, Button, Container, TextField, Typography, Alert, CircularProgress } from '@mui/material';
import { useI18n } from '@/hooks/useI18n';
import { authService, isAuthConfigured, getAuthPoolDebug } from '@/services/authService';
import { PageShell } from '@/components/layout/PageShell';

export const ForgotPasswordPage: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{
    email?: string;
    code?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  const validateEmailStep = () => {
    const errors: typeof validationErrors = {};
    if (!email.trim()) {
      errors.email = t('validation.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = t('validation.emailInvalid');
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateResetStep = () => {
    const errors: typeof validationErrors = {};
    if (!code.trim()) {
      errors.code = t('auth.resetCodeRequired');
    }
    if (!newPassword) {
      errors.newPassword = t('validation.passwordRequired');
    } else if (newPassword.length < 8) {
      errors.newPassword = t('validation.passwordMinLength');
    }
    if (newPassword !== confirmPassword) {
      errors.confirmPassword = t('validation.passwordMismatch');
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validateEmailStep()) return;
    setLoading(true);
    try {
      await authService.forgotPassword(email.trim());
      setStep('reset');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || t('auth.forgotPasswordSendFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validateResetStep()) return;
    setLoading(true);
    try {
      await authService.forgotPasswordSubmit(email.trim(), code.trim(), newPassword);
      navigate('/login', { replace: true, state: { infoMessage: t('auth.forgotPasswordSuccess') } });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || t('auth.forgotPasswordResetFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell variant="form" showBackLink>
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Box sx={{ padding: 3 }}>
          <Typography variant="h4" component="h1" gutterBottom sx={{ marginBottom: 1 }}>
            {t('auth.forgotPasswordTitle')}
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ marginBottom: 3 }}>
            {step === 'email' ? t('auth.forgotPasswordDesc') : t('auth.forgotPasswordEnterCode')}
          </Typography>

          {!isAuthConfigured() && (
            <Alert severity="warning" sx={{ marginBottom: 2 }}>
              Auth not configured. Run <code>npm run env:sync</code> to fetch Cognito config and create{' '}
              <code>apps/web/.env</code>.
            </Alert>
          )}

          {isAuthConfigured() && import.meta.env.DEV && getAuthPoolDebug() && (
            <Alert severity="info" sx={{ marginBottom: 2 }} icon={false}>
              <Typography variant="caption" component="span">
                Local Cognito pool: <strong>{getAuthPoolDebug()}</strong>.
              </Typography>
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ marginBottom: 2 }}>
              {error}
            </Alert>
          )}

          {step === 'email' ? (
            <form onSubmit={handleSendCode}>
              <TextField
                fullWidth
                label={t('auth.email')}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={!!validationErrors.email}
                helperText={validationErrors.email}
                disabled={loading}
                margin="normal"
                autoComplete="email"
              />
              <Button
                fullWidth
                variant="contained"
                color="primary"
                type="submit"
                disabled={loading || !isAuthConfigured()}
                sx={{ marginY: 2, padding: '10px' }}
              >
                {loading ? <CircularProgress size={24} /> : t('auth.sendResetCode')}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword}>
              <TextField
                fullWidth
                label={t('auth.email')}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                margin="normal"
                autoComplete="email"
              />
              <TextField
                fullWidth
                label={t('auth.resetCodeLabel')}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                error={!!validationErrors.code}
                helperText={validationErrors.code}
                disabled={loading}
                margin="normal"
                autoComplete="one-time-code"
              />
              <TextField
                fullWidth
                label={t('auth.newPassword')}
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                error={!!validationErrors.newPassword}
                helperText={validationErrors.newPassword}
                disabled={loading}
                margin="normal"
                autoComplete="new-password"
              />
              <TextField
                fullWidth
                label={t('auth.confirmPassword')}
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={!!validationErrors.confirmPassword}
                helperText={validationErrors.confirmPassword}
                disabled={loading}
                margin="normal"
                autoComplete="new-password"
              />
              <Button
                fullWidth
                variant="contained"
                color="primary"
                type="submit"
                disabled={loading || !isAuthConfigured()}
                sx={{ marginY: 2, padding: '10px' }}
              >
                {loading ? <CircularProgress size={24} /> : t('auth.setNewPassword')}
              </Button>
              <Button fullWidth variant="text" type="button" disabled={loading} onClick={() => setStep('email')}>
                {t('auth.backToEmailStep')}
              </Button>
            </form>
          )}

          <Box sx={{ marginTop: 3, textAlign: 'center' }}>
            <Typography variant="body2">
              <Link to="/login" style={{ textDecoration: 'none', color: '#1976d2' }}>
                {t('auth.loginLink')}
              </Link>
            </Typography>
          </Box>
        </Box>
      </Container>
    </PageShell>
  );
};
