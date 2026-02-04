import React, { useEffect, useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useMe } from '@/hooks/useMe';
import { authService } from '@/services/authService';
import { billingService } from '@/services/billingService';

interface ProtectedRouteProps {
  isAdmin?: boolean;
  requireProfileComplete?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  isAdmin = false,
  requireProfileComplete = true,
}) => {
  const { isAuthenticated, isLoading, user } = useAuthContext();
  const { me, loading: meLoading, refreshMe } = useMe();
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

  if (isLoading || (isAuthenticated && meLoading)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (isAdmin && !isAdminUser) {
    return <Navigate to="/app/discover" replace />;
  }

  const profileJustCompleted = (location.state as { profileJustCompleted?: boolean } | null)?.profileJustCompleted;
  const isSubscriptionPage = location.pathname === '/app/subscription';
  const isProfilePage = location.pathname === '/app/profile';
  if (requireProfileComplete && !profileComplete && !profileJustCompleted && !isSubscriptionPage && !isProfilePage) {
    return <Navigate to="/onboarding/profile" replace state={{ from: location }} />;
  }

  return <Outlet />;
};
