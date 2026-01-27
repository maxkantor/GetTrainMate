import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Alert, Snackbar } from '@mui/material';
import { adminApiService } from '@/services/adminApiService';

const SESSION_STORAGE_KEY = 'admin_session';

interface AdminRouteProps {
  // No props needed - uses Outlet pattern
}

/**
 * Admin route guard that checks for valid admin session
 * Uses SSM-based password authentication with cached sessions
 */
export const AdminRoute: React.FC<AdminRouteProps> = () => {
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAdminSession = async () => {
      try {
        const sessionData = localStorage.getItem(SESSION_STORAGE_KEY);
        
        if (!sessionData) {
          setIsAdmin(false);
          return;
        }

        const session = JSON.parse(sessionData);
        
        // Check if session is expired
        if (new Date(session.expiresAt) <= new Date()) {
          localStorage.removeItem(SESSION_STORAGE_KEY);
          setIsAdmin(false);
          return;
        }

        // Validate session with backend
        try {
          await adminApiService.post('/api/admin/login/validate-session', {
            sessionToken: session.sessionToken,
            email: session.email,
          });
          
          setIsAdmin(true);
        } catch (err) {
          // Session invalid
          localStorage.removeItem(SESSION_STORAGE_KEY);
          setIsAdmin(false);
          setError('Session expired. Please login again.');
        }
      } catch (err) {
        console.error('Error checking admin session:', err);
        setIsAdmin(false);
        setError('Error checking admin access');
      }
    };

    checkAdminSession();
  }, []);

  if (isAdmin === null) {
    // Still checking
    return <div>Checking admin access...</div>;
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
            {error || 'Please login to access the admin portal'}
          </Alert>
        </Snackbar>
      </>
    );
  }

  return <Outlet />;
};
