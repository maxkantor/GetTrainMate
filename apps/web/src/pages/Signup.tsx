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
} from '@mui/material';
import { useI18n } from '@/hooks/useI18n';
import { useAuthContext } from '@/hooks/useAuthContext';
import { BackLink } from '@/components/ui/BackLink';
import styles from './Signup.module.css';

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
  const { signup, isLoading } = useAuthContext();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const validateForm = () => {
    const errors: typeof validationErrors = {};
    
    if (!name || name.trim().length < 2) {
      errors.name = t('validation.nameRequired');
    }
    
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
      await signup(email, password, name);
      navigate('/verify-email', { state: { email } });
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : t('errors.signupFailed');
      setError(errMessage);
    }
  };

  return (
    <>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '8px 24px 0' }}>
        <BackLink label="Back" />
      </div>
      <Container maxWidth="sm" sx={{ py: 8 }}>
      <Box sx={{ backgroundColor: '#fff', padding: 4, borderRadius: 2, boxShadow: 1 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ marginBottom: 1 }}>
          {t('auth.signup_title')}
        </Typography>
        <Typography variant="body2" color="textSecondary" sx={{ marginBottom: 3 }}>
          {t('auth.joinUs')}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ marginBottom: 2 }}>
            {error}
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
    </>
  );
};
