import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { fetchAuthSession, getCurrentUser } from 'aws-amplify/auth';
import { Alert, Snackbar } from '@mui/material';

interface AdminRouteProps {
  children: React.ReactNode;
}

/**
 * Admin route guard that checks if user is in admin allowlist
 * Checks JWT claims (sub, cognito:username, email) against allowlist
 */
export const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { isAuthenticated } = useAuthContext();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAdminAccess = async () => {
      if (!isAuthenticated) {
        setIsAdmin(false);
        return;
      }

      try {
        // Get ID token from Amplify
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken;

        if (!idToken) {
          setIsAdmin(false);
          setError('No authentication token found');
          return;
        }

        // Extract claims
        const sub = idToken.payload.sub as string | undefined;
        const cognitoUsername = idToken.payload['cognito:username'] as string | undefined;
        const email = idToken.payload.email as string | undefined;

        // Get allowlist from environment (same as backend)
        const allowlistEnv = import.meta.env.VITE_ADMIN_ALLOWLIST || 'mykantor@bellsouth.net';
        const allowlist = allowlistEnv
          .split(',')
          .map((item: string) => item.trim().toLowerCase())
          .filter((item: string) => item.length > 0);

        // Check if ANY claim matches ANY allowlist entry
        const claims = [sub, cognitoUsername, email]
          .filter((claim): claim is string => !!claim)
          .map((claim) => claim.toLowerCase());

        const isInAllowlist = claims.some((claim) =>
          allowlist.some((allowed) => claim === allowed)
        );

        setIsAdmin(isInAllowlist);

        if (!isInAllowlist) {
          setError('Access denied: You are not authorized to access the admin portal');
        }
      } catch (err) {
        console.error('Error checking admin access:', err);
        setIsAdmin(false);
        setError('Error checking admin access');
      }
    };

    checkAdminAccess();
  }, [isAuthenticated]);

  if (isAdmin === null) {
    // Still checking
    return <div>Checking admin access...</div>;
  }

  if (!isAdmin) {
    return (
      <>
        <Navigate to="/" replace state={{ from: location }} />
        <Snackbar
          open={!!error}
          autoHideDuration={6000}
          onClose={() => setError(null)}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert severity="error" onClose={() => setError(null)}>
            {error || 'Access denied'}
          </Alert>
        </Snackbar>
      </>
    );
  }

  return <>{children}</>;
};
