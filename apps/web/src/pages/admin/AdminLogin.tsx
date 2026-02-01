import React, { useState } from 'react';
import { Box, Button, Card, CardContent, Container, TextField, Typography, Alert } from '@mui/material';
import { adminService } from '@/services/adminService';

export const AdminLoginPage: React.FC = () => {
  const [email, setEmail] = useState('admin@gettrainmate.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      setLoading(true);
      const res = await adminService.login(email, password);
      const token = res.token ?? (res as { sessionToken?: string }).sessionToken;
      if (token) localStorage.setItem('adminToken', token);
      localStorage.setItem('admin_session', JSON.stringify({
        sessionToken: token,
        email: res.admin?.email ?? (res as { email?: string }).email ?? email,
        expiresAt: (res as { expiresAt?: string }).expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }));
      window.location.href = '/admin/content';
    } catch (err: unknown) {
      const ax = err && typeof err === 'object' && 'response' in err ? err as { response?: { data?: { error?: string } }; message?: string } : null;
      const msg = ax?.response?.data?.error ?? ax?.message ?? (err instanceof Error ? err.message : 'Login failed');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>Admin Login</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Use your admin password stored in SSM. After login, a short-lived admin token will be saved locally.
          </Typography>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              required
              sx={{ mb: 2 }}
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              required
              sx={{ mb: 2 }}
            />
            <Button type="submit" variant="contained" fullWidth disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Tip: Retrieve the password via SSM: aws ssm get-parameter --name "/gettrainmate/admin/password" --with-decryption
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
};
