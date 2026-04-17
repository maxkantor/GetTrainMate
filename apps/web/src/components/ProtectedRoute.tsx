import React, { useEffect, useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { CircularProgress, Box, Alert } from '@mui/material';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useMe } from '@/hooks/useMe';
import { authService } from '@/services/authService';
import { billingService } from '@/services/billingService';

interface ProtectedRouteProps {
  isAdmin?: boolean;
  requireProfileComplete?: boolean;
}

const DEV = import.meta.env.DEV;

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  isAdmin = false,
  requireProfileComplete: _requireProfileComplete = true,
}) => {
  const { isAuthenticated, isLoading, user } = useAuthContext();
  const { me, loading: meLoading, error: meError, refreshMe } = useMe();
  const location = useLocation();
  const freeCreditsRequested = useRef(false);

  // Grant free signup credits once (idempotent on backend)
  useEffect(() => {
    if (!isAuthenticated || freeCreditsRequested.current) return;
    freeCreditsRequested.current = true;
    authService.getJWT().then((token) => {
      if (token) billingService.grantFreeSignup(token).then(() => refreshMe()).catch(() => {});
    });
  }, [isAuthenticated, refreshMe]);

  const profileComplete = me?.isProfileComplete ?? false;
  const isAdminUser = me?.isAdmin ?? user?.groups?.includes('Admin') ?? false;
  const profileLoaded = me !== null;
  const profileFetchFailed = !meLoading && isAuthenticated && profileLoaded === false && meError != null;

  if (DEV) {
    if (!isLoading && isAuthenticated) {
      if (meLoading) {
        console.log('[ProtectedRoute] Auth OK, profile loading…');
      } else if (me != null) {
        console.log('[ProtectedRoute] Profile loaded:', me.user?.id ?? 'no-id', 'onboarding required:', !profileComplete, 'reason:', profileComplete ? 'profile complete' : 'profile incomplete');
      } else if (meError) {
        console.log('[ProtectedRoute] Profile load failed (not redirecting to onboarding):', typeof meError === 'string' ? meError : 'An unexpected error occurred');
      }
    }
  }

  if (isLoading || (isAuthenticated && meLoading)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    if (DEV) console.log('[ProtectedRoute] Redirecting to /login (not authenticated)');
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (isAdmin && !isAdminUser) {
    if (DEV) console.log('[ProtectedRoute] Redirecting to /app (not admin)');
    return <Navigate to="/app" replace />;
  }

  // Profile completion is handled on the dashboard (quick setup) and Discover guard — do not redirect away from /app.

  return (
    <>
      {profileFetchFailed && (
        <Alert severity="warning" sx={{ borderRadius: 0 }} onClose={() => {}}>
          We couldn&apos;t load your profile. You can try again from Settings or continue browsing.
        </Alert>
      )}
      <Outlet />
    </>
  );
};
