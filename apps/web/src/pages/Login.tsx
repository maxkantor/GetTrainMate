import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
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
import styles from '@/styles/Auth.module.css';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useI18n();

  useEffect(() => {
    const plan = searchParams.get('plan');
    if (plan === 'pro' || plan === 'elite') {
      localStorage.setItem('selectedPlanKey', plan);
    }
  }, [searchParams]);
  const { login, confirmSignInWithNewPassword, isLoading } = useAuthContext();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
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
        if (rememberMe) {
          localStorage.setItem('rememberEmail', email);
        }
        const plan = localStorage.getItem('selectedPlanKey');
        if (plan === 'pro' || plan === 'elite') {
          localStorage.removeItem('selectedPlanKey');
          navigate(`/pricing?checkout=${plan}`);
          return;
        }
        navigate('/app/discover');
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
        if (rememberMe) {
          localStorage.setItem('rememberEmail', email);
        }
        const plan = localStorage.getItem('selectedPlanKey');
        if (plan === 'pro' || plan === 'elite') {
          localStorage.removeItem('selectedPlanKey');
          navigate(`/pricing?checkout=${plan}`);
          return;
        }
        navigate('/app/discover');
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
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Box sx={{ backgroundColor: '#fff', padding: 4, borderRadius: 2, boxShadow: 1 }}>
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
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Box sx={{ backgroundColor: '#fff', padding: 4, borderRadius: 2, boxShadow: 1 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ marginBottom: 1 }}>
          {t('auth.login_title')}
        </Typography>
        <Typography variant="body2" color="textSecondary" sx={{ marginBottom: 3 }}>
          {t('auth.welcomeBack')}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ marginBottom: 2 }}>
            {error}
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
            disabled={isLoading}
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
  );
};
