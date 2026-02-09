import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useI18n } from '@/hooks/useI18n';
import { useAuthContext } from '@/hooks/useAuthContext';
import { PageShell } from '@/components/layout/PageShell';

export const VerifyEmailPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const { confirmSignUp, isLoading } = useAuthContext();

  const stateData = (location.state as { email?: string; username?: string } | null) ?? {};
  const stateEmail = stateData.email ?? '';
  const stateUsername = stateData.username ?? '';
  const [email, setEmail] = useState(stateEmail);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<{ email?: string; code?: string }>({});

  const validateForm = () => {
    const errors: { email?: string; code?: string } = {};
    if (!stateEmail && (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      errors.email = t('validation.emailInvalid');
    }
    if (!code || code.trim().length < 4) {
      errors.code = 'Enter the 6-digit code from your email';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validateForm()) return;
    if (!stateUsername) {
      setError('Session expired. Please sign up again to receive a new code.');
      return;
    }

    try {
      const result = await confirmSignUp(stateUsername, code.trim());
      if (result.success) {
        navigate('/login', { state: { email: email.trim(), message: 'Email verified. You can sign in now.' } });
      } else {
        setError(result.error ?? 'Verification failed. Please check the code and try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed. Please try again.');
    }
  };

  const codeLabel = t('auth.verifyCode') || 'Verification code';
  const needEmail = !stateEmail;

  return (
    <PageShell variant="form" showBackLink>
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Box sx={{ padding: 3 }}>
          <Typography variant="h4" component="h1" gutterBottom sx={{ marginBottom: 1 }}>
            {t('auth.verifyEmailTitle')}
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ marginBottom: 3 }}>
            {t('auth.verifyEmail')}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ marginBottom: 2 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            {needEmail && (
              <TextField
                fullWidth
                label={t('auth.email')}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={!!validationErrors.email}
                helperText={validationErrors.email}
                disabled={isLoading}
                margin="normal"
                autoComplete="email"
              />
            )}

            <TextField
              fullWidth
              label={codeLabel}
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              error={!!validationErrors.code}
              helperText={validationErrors.code}
              disabled={isLoading}
              margin="normal"
              autoComplete="one-time-code"
              inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 6 }}
              placeholder="000000"
            />

            <Button
              fullWidth
              variant="contained"
              color="primary"
              type="submit"
              disabled={isLoading}
              sx={{ marginY: 2, padding: '10px' }}
            >
              {isLoading ? <CircularProgress size={24} /> : t('auth.confirmSignUp') || 'Verify'}
            </Button>
          </form>

          <Box sx={{ marginTop: 3, textAlign: 'center' }}>
            <Typography variant="body2">
              {t('auth.hasAccount')}{' '}
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
