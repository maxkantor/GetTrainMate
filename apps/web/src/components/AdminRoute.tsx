import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Alert, Box, CircularProgress, Snackbar } from '@mui/material';
import { adminApiService } from '@/services/adminApiService';

/**
 * Requires a valid admin password session (X-Admin-Token).
 * Does not treat Cognito app login as admin access.
 */
export const AdminRoute: React.FC = () => {
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const checkAdminSession = async () => {
      setError(null);
      try {
        await adminApiService.get('/api/admin/auth/session');
        if (!cancelled) setIsAdmin(true);
      } catch (err: unknown) {
        if (!cancelled) {
          setIsAdmin(false);
          const msg = err instanceof Error ? err.message : 'Please sign in';
          if (!/session required/i.test(msg)) setError(msg);
        }
      }
    };

    setIsAdmin(null);
    void checkAdminSession();

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  if (isAdmin === null) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAdmin) {
    return (
      <>
        <Navigate to="/admin/login" replace state={{ from: location }} />
        <Snackbar
          open={!!error}
          autoHideDuration={6000}
          onClose={() => setError(null)}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert severity="error" onClose={() => setError(null)}>
            {error || 'Please sign in to access the admin portal'}
          </Alert>
        </Snackbar>
      </>
    );
  }

  return <Outlet />;
};
