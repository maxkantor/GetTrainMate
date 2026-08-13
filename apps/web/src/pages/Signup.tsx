import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useSearchParams, Navigate } from 'react-router-dom';
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
import { trackEvent, trackSignUp } from '@/utils/analytics';
import { savePendingSignup } from '@/utils/pendingSignupStorage';
import {
  captureAcquisitionFromSearch,
  mergeAndPersistAcquisition,
} from '@/utils/acquisitionAttribution';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useI18n();

  useEffect(() => {
    const plan = searchParams.get('plan');
    if (plan === 'pro' || plan === 'elite') {
      localStorage.setItem('selectedPlanKey', plan);
    }
  }, [searchParams]);
  const { signup, resendSignupCode, isLoading, isAuthenticated } = useAuthContext();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitResendUsername, setSubmitResendUsername] = useState<string | null>(null);
  const [failedRegistrationStatus, setFailedRegistrationStatus] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const startedRef = useRef(false);
  const completedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (startedRef.current && !completedRef.current) {
        trackEvent('signup_abandoned', { source_page: '/signup' });
      }
    };
  }, []);

  useEffect(() => {
    setError('');
    setSubmitResendUsername(null);
    setFailedRegistrationStatus(null);
    setResendNotice(null);
  }, [email]);

  const validateForm = () => {
    const errors: typeof validationErrors = {};

    if (!name || name.trim().length < 2) {
      errors.name = t('validation.nameRequired');
    }

    if (!email) {
      errors.email = t('validation.emailRequired');
    } else if (!EMAIL_RE.test(email)) {
      errors.email = t('validation.emailInvalid');
    }

    if (!password) {
      errors.password = t('validation.passwordRequired');
    } else if (password.length < 8) {
      errors.password = t('validation.passwordMinLength');
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = t('validation.passwordMismatch');
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitResendUsername(null);
    setFailedRegistrationStatus(null);
    setResendNotice(null);

    if (!validateForm()) {
      return;
    }

    startedRef.current = true;
    const src = searchParams.get('src') || undefined;
    const metro = searchParams.get('metro') || undefined;
    const mode = searchParams.get('mode') || undefined;
    // Persist acquisition params across verify-email → app → pricing/checkout (no PII).
    mergeAndPersistAcquisition(captureAcquisitionFromSearch(searchParams));
    trackEvent('signup_started', {
      source_page: '/signup',
      ...(src ? { acquisition_source: src } : {}),
      ...(metro ? { metro } : {}),
      ...(mode ? { mode } : {}),
    });
    trackEvent('email_submitted', { source_page: '/signup', ...(src ? { acquisition_source: src } : {}) });

    try {
      // signup() runs check-email first; only calls Cognito signUp when email is available
      const result = await signup(email, password, name);
      if (result.success && result.username) {
        completedRef.current = true;
        trackEvent('verification_code_sent', { source_page: '/signup' });
        trackSignUp('email');
        savePendingSignup({
          email: email.trim(),
          username: result.username,
          password,
          fullName: name.trim(),
        });
        navigate('/verify-email', { state: { email: email.trim(), username: result.username } });
      } else if (!result.success) {
        trackEvent('signup_failed', {
          source_page: '/signup',
          error_type: result.registrationStatus ?? 'signup_failed',
        });
        setError(result.error ?? t('errors.signupFailed'));
        if (result.resendUsername) setSubmitResendUsername(result.resendUsername);
        if (result.registrationStatus) setFailedRegistrationStatus(result.registrationStatus);
      }
    } catch (err) {
      trackEvent('signup_failed', {
        source_page: '/signup',
        error_type: 'exception',
      });
      const errMessage = err instanceof Error ? err.message : t('errors.signupFailed');
      setError(errMessage);
    }
  };

  const showResendCta =
    failedRegistrationStatus === 'ExistsUnconfirmed' && submitResendUsername != null;

  const showSignInFromError =
    failedRegistrationStatus === 'ExistsConfirmed' ||
    (error && /already exists|sign in instead/i.test(error));

  const signupAlertSeverity = failedRegistrationStatus === 'ExistsUnconfirmed' ? 'warning' : 'error';

  const handleResendCode = async () => {
    if (!submitResendUsername) return;
    setResendNotice(null);
    const r = await resendSignupCode(submitResendUsername);
    if (r.success) {
      trackEvent('verification_code_sent', {
        source_page: '/signup',
        trigger: 'resend',
      });
      setResendNotice({
        kind: 'success',
        text: 'A new verification code was sent. Check your inbox and spam folder.',
      });
    } else {
      setResendNotice({ kind: 'error', text: r.error ?? 'Could not resend the code.' });
    }
  };

  if (isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  return (
    <PageShell variant="form" showBackLink>
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Box sx={{ padding: 3 }}>
          <Typography variant="h4" component="h1" gutterBottom sx={{ marginBottom: 1 }}>
            {t('auth.signup_title')}
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ marginBottom: 3 }}>
            {t('auth.joinUs')}
          </Typography>

          {error && (
            <Alert severity={signupAlertSeverity} sx={{ marginBottom: 2 }}>
              {error}
              {showSignInFromError && (
                <Box sx={{ mt: 1.5 }}>
                  <Button
                    component={Link}
                    to="/login"
                    variant="contained"
                    size="small"
                    onClick={() => trackEvent('login_clicked', { source_page: '/signup' })}
                  >
                    Sign in
                  </Button>
                </Box>
              )}
              {showResendCta && (
                <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start' }}>
                  <Button
                    type="button"
                    variant="outlined"
                    size="small"
                    onClick={() => void handleResendCode()}
                    disabled={isLoading}
                  >
                    Resend verification email
                  </Button>
                  <Typography variant="caption" color="text.secondary">
                    <Link
                      to="/verify-email"
                      state={{ email: email.trim(), username: submitResendUsername ?? undefined }}
                    >
                      I have my code — verify now
                    </Link>
                  </Typography>
                </Box>
              )}
            </Alert>
          )}

          {resendNotice && (
            <Alert severity={resendNotice.kind === 'success' ? 'success' : 'error'} sx={{ marginBottom: 2 }}>
              {resendNotice.text}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label={t('auth.name')}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={!!validationErrors.name}
              helperText={validationErrors.name}
              disabled={isLoading}
              margin="normal"
              autoComplete="name"
            />

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

            <TextField
              fullWidth
              label={t('auth.password')}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={!!validationErrors.password}
              helperText={validationErrors.password}
              disabled={isLoading}
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
              disabled={isLoading}
              margin="normal"
              autoComplete="new-password"
            />

            <Button
              fullWidth
              variant="contained"
              color="primary"
              type="submit"
              disabled={isLoading}
              sx={{ marginY: 2, padding: '10px' }}
            >
              {isLoading ? <CircularProgress size={24} /> : t('auth.signup')}
            </Button>
          </form>

          <Box sx={{ marginTop: 3, textAlign: 'center' }}>
            <Typography variant="body2">
              {t('auth.hasAccount')}{' '}
              <Link
                to="/login"
                style={{ textDecoration: 'none', color: '#1976d2' }}
                onClick={() => trackEvent('login_clicked', { source_page: '/signup' })}
              >
                {t('auth.loginLink')}
              </Link>
            </Typography>
          </Box>
        </Box>
      </Container>
    </PageShell>
  );
};
