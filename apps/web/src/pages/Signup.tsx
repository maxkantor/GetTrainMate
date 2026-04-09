import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
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
import { trackSignUp } from '@/utils/analytics';
import { checkRegistrationEmail } from '@/services/registrationCheckService';

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
  const { signup, resendSignupCode, isLoading } = useAuthContext();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitResendUsername, setSubmitResendUsername] = useState<string | null>(null);
  const [failedRegistrationStatus, setFailedRegistrationStatus] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [emailProbe, setEmailProbe] = useState<{
    status: 'idle' | 'checking' | 'available' | 'taken';
    message?: string;
    resendUsername?: string;
    registrationStatus?: string;
  }>({ status: 'idle' });
  const probeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const runEmailProbe = useCallback(async (addr: string) => {
    const trimmed = addr.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setEmailProbe({ status: 'idle' });
      return;
    }
    setEmailProbe((prev) => ({ ...prev, status: 'checking' }));
    const r = await checkRegistrationEmail(trimmed);
    if (!r.available) {
      setEmailProbe({
        status: 'taken',
        message: r.message ?? undefined,
        resendUsername: r.resendUsername ?? undefined,
        registrationStatus: r.status,
      });
    } else {
      setEmailProbe({ status: 'available' });
    }
  }, []);

  useEffect(() => {
    setSubmitResendUsername(null);
    setFailedRegistrationStatus(null);
    setResendNotice(null);
  }, [email]);

  useEffect(() => {
    if (probeTimerRef.current) clearTimeout(probeTimerRef.current);
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setEmailProbe({ status: 'idle' });
      return;
    }
    probeTimerRef.current = setTimeout(() => {
      void runEmailProbe(trimmed);
    }, 480);
    return () => {
      if (probeTimerRef.current) clearTimeout(probeTimerRef.current);
    };
  }, [email, runEmailProbe]);

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

    if (!validateForm()) {
      return;
    }

    try {
      const result = await signup(email, password, name);
      if (result.success && result.username) {
        trackSignUp('email');
        navigate('/verify-email', { state: { email, username: result.username } });
      } else if (!result.success) {
        setError(result.error ?? t('errors.signupFailed'));
        if (result.resendUsername) setSubmitResendUsername(result.resendUsername);
        if (result.registrationStatus) setFailedRegistrationStatus(result.registrationStatus);
      }
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : t('errors.signupFailed');
      setError(errMessage);
    }
  };

  const cognitoResendTarget =
    emailProbe.resendUsername ?? submitResendUsername ?? null;
  const showResendCta =
    !!cognitoResendTarget &&
    (emailProbe.registrationStatus === 'ExistsUnconfirmed' ||
      failedRegistrationStatus === 'ExistsUnconfirmed' ||
      submitResendUsername != null ||
      (emailProbe.status === 'taken' && !!emailProbe.resendUsername));

  const showSignInFromError =
    failedRegistrationStatus === 'ExistsConfirmed' ||
    (error && /already exists|sign in instead/i.test(error));

  const handleResendCode = async () => {
    if (!cognitoResendTarget) return;
    setResendNotice(null);
    const r = await resendSignupCode(cognitoResendTarget);
    if (r.success) {
      setResendNotice({
        kind: 'success',
        text: 'A new verification code was sent. Check your inbox and spam folder.',
      });
    } else {
      setResendNotice({ kind: 'error', text: r.error ?? 'Could not resend the code.' });
    }
  };

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
          <Alert severity="error" sx={{ marginBottom: 2 }}>
            {error}
            {showSignInFromError && (
              <Box sx={{ mt: 1.5 }}>
                <Button component={Link} to="/login" variant="contained" size="small">
                  Sign in
                </Button>
              </Box>
            )}
            {showResendCta && (
              <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                <Button
                  type="button"
                  variant="outlined"
                  size="small"
                  onClick={() => void handleResendCode()}
                  disabled={isLoading}
                >
                  Resend verification email
                </Button>
                <Typography variant="caption" color="text.secondary" sx={{ width: '100%' }}>
                  Already have the code?{' '}
                  <Link to="/verify-email" state={{ email: email.trim(), username: cognitoResendTarget ?? undefined }}>
                    Enter it here
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

        {emailProbe.status === 'checking' && EMAIL_RE.test(email.trim()) && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Checking email…
          </Typography>
        )}

        {emailProbe.status === 'taken' && emailProbe.message && !error && (
          <Alert severity="warning" sx={{ marginBottom: 2 }}>
            {emailProbe.message}
            {emailProbe.registrationStatus === 'ExistsConfirmed' && (
              <Box sx={{ mt: 1.5 }}>
                <Button component={Link} to="/login" variant="contained" size="small" sx={{ mr: 1 }}>
                  Sign in
                </Button>
              </Box>
            )}
            {showResendCta && emailProbe.registrationStatus === 'ExistsUnconfirmed' && (
              <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start' }}>
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
                    state={{ email: email.trim(), username: cognitoResendTarget ?? undefined }}
                  >
                    I have my code — verify now
                  </Link>
                </Typography>
              </Box>
            )}
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
