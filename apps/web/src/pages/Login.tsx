import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams, useLocation } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { useI18n } from '@/hooks/useI18n';
import { useAuthContext } from '@/hooks/useAuthContext';
import { isAuthConfigured, getAuthPoolDebug } from '@/services/authService';
import { PageShell } from '@/components/layout/PageShell';

/** Last email used for a successful sign-in (pre-filled on return visits). */
const LAST_LOGIN_EMAIL_KEY = 'gtm_last_login_email';
/** Legacy key — read once for migration */
const LEGACY_REMEMBER_EMAIL_KEY = 'rememberEmail';

function readSavedLoginEmail(): string {
  try {
    return (
      localStorage.getItem(LAST_LOGIN_EMAIL_KEY) ||
      localStorage.getItem(LEGACY_REMEMBER_EMAIL_KEY) ||
      ''
    ).trim();
  } catch {
    return '';
  }
}

function persistLoginEmail(emailTrimmed: string, remember: boolean) {
  try {
    if (remember && emailTrimmed) {
      localStorage.setItem(LAST_LOGIN_EMAIL_KEY, emailTrimmed);
      localStorage.removeItem(LEGACY_REMEMBER_EMAIL_KEY);
    } else {
      localStorage.removeItem(LAST_LOGIN_EMAIL_KEY);
      localStorage.removeItem(LEGACY_REMEMBER_EMAIL_KEY);
    }
  } catch {
    /* ignore */
  }
}

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const oauthHint = (location.state as { hint?: string } | null)?.hint;
  const [searchParams] = useSearchParams();
  const { t } = useI18n();

  useEffect(() => {
    const plan = searchParams.get('plan');
    if (plan === 'pro' || plan === 'elite') {
      localStorage.setItem('selectedPlanKey', plan);
    }
  }, [searchParams]);
  const { login, confirmSignInWithNewPassword, isLoading } = useAuthContext();

  const [email, setEmail] = useState(() => readSavedLoginEmail());
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  /** Default on so email is saved after sign-in; uncheck on shared devices to skip saving. */
  const [rememberMe, setRememberMe] = useState(true);
  const [requiresNewPassword, setRequiresNewPassword] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<{ email?: string; password?: string; newPassword?: string; confirmNewPassword?: string }>({});

  const validateForm = () => {
    const errors: typeof validationErrors = {};
    if (!email) {
      errors.email = t('validation.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = t('validation.emailInvalid');
    }
    if (!password) {
      errors.password = t('validation.passwordRequired');
    } else if (password.length < 8) {
      errors.password = t('validation.passwordMinLength');
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateNewPasswordForm = () => {
    const errors: typeof validationErrors = {};
    if (!newPassword) {
      errors.newPassword = t('validation.passwordRequired');
    } else if (newPassword.length < 8) {
      errors.newPassword = t('validation.passwordMinLength');
    }
    if (newPassword !== confirmNewPassword) {
      errors.confirmNewPassword = t('validation.passwordMismatch');
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
      const result = await login(email, password);
      if (result.success) {
        persistLoginEmail(email.trim(), rememberMe);
        const plan = localStorage.getItem('selectedPlanKey');
        if (plan === 'pro' || plan === 'elite') {
          localStorage.removeItem('selectedPlanKey');
          navigate(`/pricing?checkout=${plan}`);
          return;
        }
        navigate('/app');
      } else if (result.requiresNewPassword) {
        setRequiresNewPassword(true);
        setError('');
      } else {
        setError(result.error || t('errors.loginFailed'));
      }
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : t('errors.loginFailed');
      setError(errMessage);
    }
  };

  const handleNewPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateNewPasswordForm()) {
      return;
    }

    try {
      const result = await confirmSignInWithNewPassword(newPassword);
      if (result.success) {
        persistLoginEmail(email.trim(), rememberMe);
        const plan = localStorage.getItem('selectedPlanKey');
        if (plan === 'pro' || plan === 'elite') {
          localStorage.removeItem('selectedPlanKey');
          navigate(`/pricing?checkout=${plan}`);
          return;
        }
        navigate('/app');
      } else {
        setError(result.error || 'Failed to set new password');
      }
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : 'Failed to set new password';
      setError(errMessage);
    }
  };

  if (requiresNewPassword) {
    return (
      <PageShell variant="form" showBackLink>
        <Container maxWidth="sm" sx={{ py: 4 }}>
        <Box sx={{ padding: 3 }}>
          <Typography variant="h4" component="h1" gutterBottom sx={{ marginBottom: 1 }}>
            Set New Password
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ marginBottom: 3 }}>
            Please set a new password to continue
          </Typography>

          {error && (
            <Alert severity="error" sx={{ marginBottom: 2 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleNewPasswordSubmit}>
            <TextField
              fullWidth
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              error={!!validationErrors.newPassword}
              helperText={validationErrors.newPassword}
              disabled={isLoading}
              margin="normal"
              autoComplete="new-password"
            />

            <TextField
              fullWidth
              label="Confirm New Password"
              type="password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              error={!!validationErrors.confirmNewPassword}
              helperText={validationErrors.confirmNewPassword}
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
              {isLoading ? <CircularProgress size={24} /> : 'Set New Password'}
            </Button>
          </form>
        </Box>
      </Container>
      </PageShell>
    );
  }

  return (
    <PageShell variant="form" showBackLink>
      <Container maxWidth="sm" sx={{ py: 4 }}>
      <Box sx={{ padding: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ marginBottom: 1 }}>
          {t('auth.login_title')}
        </Typography>
        <Typography variant="body2" color="textSecondary" sx={{ marginBottom: 3 }}>
          {t('auth.welcomeBack')}
        </Typography>

        {!isAuthConfigured() && (
          <Alert severity="warning" sx={{ marginBottom: 2 }}>
            Auth not configured. Run <code>npm run env:sync</code> to fetch Cognito config from the deployed CDK stack and create <code>apps/web/.env</code>.
          </Alert>
        )}

        {isAuthConfigured() && import.meta.env.DEV && getAuthPoolDebug() && (
          <Alert severity="info" sx={{ marginBottom: 2 }} icon={false}>
            <Typography variant="caption" component="span">
              Local Cognito pool: <strong>{getAuthPoolDebug()}</strong>. If login works on Amplify but not here, use the <strong>same</strong> pool: Amplify → Environment variables → copy <code>VITE_COGNITO_USER_POOL_ID</code> and <code>VITE_COGNITO_CLIENT_ID</code> into <code>apps/web/.env</code>, then restart dev server.
            </Typography>
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ marginBottom: 2 }}>
            {error}
          </Alert>
        )}

        {oauthHint && (
          <Alert severity="info" sx={{ marginBottom: 2 }}>
            Google sign-in did not start ({oauthHint}). Continue with email, or configure Cognito Hosted UI with Google
            for your user pool.
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
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
            autoComplete="username email"
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
            autoComplete="current-password"
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={isLoading}
              />
            }
            label={t('auth.rememberMe')}
            sx={{ marginY: 2 }}
          />

          <Button
            fullWidth
            variant="contained"
            color="primary"
            type="submit"
            disabled={isLoading || !isAuthConfigured()}
            sx={{ marginY: 2, padding: '10px' }}
          >
            {isLoading ? <CircularProgress size={24} /> : t('auth.login')}
          </Button>
        </form>

        <Box sx={{ marginTop: 3, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ marginBottom: 1 }}>
            {t('auth.noAccount')}{' '}
            <Link to="/signup" style={{ textDecoration: 'none', color: '#1976d2' }}>
              {t('auth.signupLink')}
            </Link>
          </Typography>
          <Typography variant="body2">
            <Link to="/forgot-password" style={{ textDecoration: 'none', color: '#1976d2' }}>
              {t('auth.forgotPassword')}
            </Link>
          </Typography>
        </Box>
      </Box>
    </Container>
    </PageShell>
  );
};
