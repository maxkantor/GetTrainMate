import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  TextField,
  Button,
  Typography,
  Paper,
  Alert,
  Checkbox,
  FormControlLabel,
  CircularProgress,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import { adminApiService } from '@/services/adminApiService';

const SESSION_STORAGE_KEY = 'admin_session';
const PASSWORD_CACHE_KEY = 'admin_password_cache';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CachedPassword {
  password: string;
  cachedAt: number;
}

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('mykantor@bellsouth.net');
  const [password, setPassword] = useState('');
  const [rememberPassword, setRememberPassword] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      try {
        const sessionData = localStorage.getItem(SESSION_STORAGE_KEY);
        if (sessionData) {
          const session = JSON.parse(sessionData);
          
          // Check if session is still valid
          if (new Date(session.expiresAt) > new Date()) {
            // Validate session with backend
            try {
              await adminApiService.post('/api/admin/login/validate-session', {
                sessionToken: session.sessionToken,
                email: session.email,
              }, true); // Skip auth for session validation
              
              // Session is valid, redirect to admin portal
              navigate('/admin/dashboard', { replace: true });
              return;
            } catch (err) {
              // Session invalid, clear it
              localStorage.removeItem(SESSION_STORAGE_KEY);
            }
          } else {
            // Session expired
            localStorage.removeItem(SESSION_STORAGE_KEY);
          }
        }

        // Load cached password if available
        const cachedPasswordData = localStorage.getItem(PASSWORD_CACHE_KEY);
        if (cachedPasswordData) {
          try {
            const cached: CachedPassword = JSON.parse(cachedPasswordData);
            const age = Date.now() - cached.cachedAt;
            
            if (age < CACHE_DURATION) {
              setPassword(cached.password);
              setRememberPassword(true);
            } else {
              // Cache expired
              localStorage.removeItem(PASSWORD_CACHE_KEY);
            }
          } catch (err) {
            // Invalid cache, clear it
            localStorage.removeItem(PASSWORD_CACHE_KEY);
          }
        }
      } catch (err) {
        console.error('Error checking session:', err);
      } finally {
        setCheckingSession(false);
      }
    };

    checkSession();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await adminApiService.post('/api/admin/login', {
        email,
        password,
      }, true); // Skip auth for login endpoint

      if (response.success) {
        // Store session
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
          sessionToken: response.sessionToken,
          expiresAt: response.expiresAt,
          email: response.email,
        }));

        // Cache password if requested
        if (rememberPassword) {
          const cacheData: CachedPassword = {
            password,
            cachedAt: Date.now(),
          };
          localStorage.setItem(PASSWORD_CACHE_KEY, JSON.stringify(cacheData));
        } else {
          localStorage.removeItem(PASSWORD_CACHE_KEY);
        }

        // Redirect to admin portal
        navigate('/admin/dashboard', { replace: true });
      } else {
        setError('Login failed');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          py: 4,
        }}
      >
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
            <LockIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="h4" component="h1" gutterBottom>
              Admin Portal Login
            </Typography>
            <Typography variant="body2" color="text.secondary">
              GetTrainMate Admin Access
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleLogin}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              margin="normal"
              required
              autoComplete="email"
              autoFocus
            />

            <TextField
              fullWidth
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              required
              autoComplete="current-password"
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={rememberPassword}
                  onChange={(e) => setRememberPassword(e.target.checked)}
                />
              }
              label="Remember password (cached locally for 7 days)"
              sx={{ mt: 1, mb: 2 }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              sx={{ mt: 2 }}
            >
              {loading ? <CircularProgress size={24} /> : 'Login'}
            </Button>
          </form>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 3, textAlign: 'center' }}>
            Password is stored securely in AWS Systems Manager Parameter Store
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};
