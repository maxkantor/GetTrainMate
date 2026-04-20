import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link, Navigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  Stack,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useI18n } from '@/hooks/useI18n';
import { useAuthContext } from '@/hooks/useAuthContext';
import { PageShell } from '@/components/layout/PageShell';
import { trackEvent } from '@/utils/analytics';
import {
  readPendingSignup,
  clearPendingSignup,
  markPostVerifyWelcome,
  rememberSignupDisplayName,
  setNewUserDashboardGreeting,
} from '@/utils/pendingSignupStorage';

export const VerifyEmailPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const { confirmSignUp, resendSignupCode, login, isLoading, isAuthenticated } = useAuthContext();

  const loc = (location.state as { email?: string; username?: string } | null) ?? {};
  const initialPending = readPendingSignup();

  const [email, setEmail] = useState(() => loc.email ?? initialPending?.email ?? '');
  const [username, setUsername] = useState(() => loc.username ?? initialPending?.username ?? '');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [codeFieldError, setCodeFieldError] = useState('');
  const [resendOk, setResendOk] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ email?: string; code?: string }>({});

  useEffect(() => {
    const p = readPendingSignup();
    if (p?.email) setEmail((e) => e || p.email);
    if (p?.username) setUsername((u) => u || p.username);
  }, []);

  const needEmailField = !email?.trim();

  const validateForm = () => {
    const errors: { email?: string; code?: string } = {};
    const em = email.trim();
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      errors.email = t('validation.emailInvalid');
    }
    if (!code || code.trim().length < 4) {
      errors.code = 'Enter the confirmation code from your email';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCodeFieldError('');
    setResendOk(false);
    if (!validateForm()) return;

    trackEvent('verification_code_submitted', { source_page: '/verify-email' });

    const u = username.trim();
    if (!u) {
      setError('Session expired. Go back to sign up to request a new code.');
      return;
    }

    const p = readPendingSignup();
    const pass = p?.password;
    if (!pass) {
      setError(
        'We need your password to sign you in after verification. Go back to Sign up, enter your details again, and we’ll send a fresh code — or sign in if you already verified.'
      );
      return;
    }

    try {
      const result = await confirmSignUp(u, code.trim());
      if (!result.success) {
        trackEvent('signup_failed', {
          source_page: '/verify-email',
          error_type: 'verification_failed',
        });
        const msg = result.error ?? 'Verification failed. Check the code and try again.';
        const friendly =
          /expired|invalid|mismatch|not.*match|code/i.test(msg)
            ? msg
            : 'That code doesn’t look right. Try again or request a new code.';
        setCodeFieldError(friendly);
        return;
      }

      const loginEmail = email.trim() || p?.email || '';
      const fullName = p?.fullName?.trim();
      if (fullName) rememberSignupDisplayName(fullName);
      setNewUserDashboardGreeting();
      markPostVerifyWelcome();

      const loginRes = await login(loginEmail, pass);
      clearPendingSignup();

      if (!loginRes.success) {
        trackEvent('signup_failed', {
          source_page: '/verify-email',
          error_type: 'post_verify_login_failed',
        });
        setError(
          loginRes.error ??
            'Email verified. Please sign in with your email and password.'
        );
        navigate('/login', { state: { email: loginEmail } });
        return;
      }

      trackEvent('signup_completed', { source_page: '/verify-email' });

      navigate('/app', { replace: true });
    } catch (err) {
      trackEvent('signup_failed', {
        source_page: '/verify-email',
        error_type: 'exception',
      });
      setCodeFieldError(err instanceof Error ? err.message : 'Verification failed. Please try again.');
    }
  };

  const handleResend = async () => {
    setError('');
    setCodeFieldError('');
    setResendOk(false);
    const u = username.trim();
    if (!u) {
      setError('Missing account reference. Go back to sign up.');
      return;
    }
    const r = await resendSignupCode(u);
    if (r.success) {
      trackEvent('verification_code_sent', {
        source_page: '/verify-email',
        trigger: 'resend',
      });
      setResendOk(true);
    } else {
      setError(r.error ?? 'Could not resend the code. Try again in a moment.');
    }
  };

  const codeLabel = t('auth.verifyCode') || 'Confirmation code';

  if (isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  return (
    <PageShell variant="form" showBackLink>
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Box sx={{ padding: 3 }}>
          <Typography variant="h4" component="h1" gutterBottom sx={{ marginBottom: 1, fontWeight: 800 }}>
            Confirm your email
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ marginBottom: 3 }}>
            Enter the confirmation code we sent to your email.
          </Typography>

          {email ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Sent to <strong>{email}</strong>
            </Typography>
          ) : null}

          {error && (
            <Alert severity="error" sx={{ marginBottom: 2 }}>
              {error}
            </Alert>
          )}

          {resendOk && (
            <Alert severity="success" sx={{ marginBottom: 2 }}>
              A new code was sent. Check your inbox and spam folder.
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            {needEmailField && (
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
              onChange={(e) => {
                setCodeFieldError('');
                setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
              }}
              error={!!validationErrors.code || !!codeFieldError}
              helperText={validationErrors.code || codeFieldError || undefined}
              disabled={isLoading}
              margin="normal"
              autoComplete="one-time-code"
              inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 6 }}
              placeholder="000000"
            />

            <Stack spacing={1.5} sx={{ mt: 2 }}>
              <Button
                fullWidth
                variant="contained"
                color="primary"
                type="submit"
                disabled={isLoading}
                size="large"
                sx={{ py: 1.25 }}
              >
                {isLoading ? <CircularProgress size={24} /> : 'Verify'}
              </Button>
              <Button
                fullWidth
                variant="outlined"
                type="button"
                disabled={isLoading || !username}
                onClick={() => void handleResend()}
              >
                {t('auth.resendCode')}
              </Button>
              <Button
                fullWidth
                variant="text"
                component={Link}
                to="/signup"
                startIcon={<ArrowBackIcon />}
                sx={{ color: 'text.secondary' }}
              >
                Back
              </Button>
            </Stack>
          </form>

          <Box sx={{ marginTop: 3, textAlign: 'center' }}>
            <Typography variant="body2">
              {t('auth.hasAccount')}{' '}
              <Link to="/login" style={{ textDecoration: 'none', color: 'var(--mui-palette-primary-main, #6366f1)' }}>
                {t('auth.loginLink')}
              </Link>
            </Typography>
          </Box>
        </Box>
      </Container>
    </PageShell>
  );
};
