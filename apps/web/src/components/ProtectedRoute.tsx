import React, { useState, useEffect, useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { useAuthContext } from '@/hooks/useAuthContext';
import { profileService } from '@/services/profileService';
import { authService } from '@/services/authService';
import { billingService } from '@/services/billingService';

interface ProtectedRouteProps {
  isAdmin?: boolean;
  requireProfileComplete?: boolean; // New prop to gate behind profile completion
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  isAdmin = false,
  requireProfileComplete = true, // Default to requiring profile completion
}) => {
  const { isAuthenticated, isLoading, user } = useAuthContext();
  const location = useLocation();
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileComplete, setProfileComplete] = useState(false);
  const freeCreditsRequested = useRef(false);

  // Grant free signup credits once (idempotent on backend)
  useEffect(() => {
    if (!isAuthenticated || freeCreditsRequested.current) return;
    freeCreditsRequested.current = true;
    authService.getJWT().then((token) => {
      if (token) billingService.grantFreeSignup(token).catch(() => {});
    });
  }, [isAuthenticated]);

  // Check profile completion if required; re-run when pathname changes so we get fresh data after onboarding
  useEffect(() => {
    const checkProfile = async () => {
      if (!isAuthenticated || !requireProfileComplete) {
        setProfileLoading(false);
        return;
      }

      try {
        const token = await authService.getJWT();
        if (!token) {
          setProfileLoading(false);
          return;
        }

        const profile = await profileService.getMyProfile(token);
        setProfileComplete(profile.isComplete || false);
      } catch (error) {
        console.error('Error checking profile:', error);
        setProfileComplete(false);
      } finally {
        setProfileLoading(false);
      }
    };

    if (isAuthenticated) {
      checkProfile();
    } else {
      setProfileLoading(false);
    }
  }, [isAuthenticated, requireProfileComplete, location.pathname]);

  if (import.meta.env.DEV) {
    console.debug('ProtectedRoute:', { isAuthenticated, profileComplete, requireProfileComplete });
  }

  if (isLoading || profileLoading) {
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

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (isAdmin && !user?.groups?.includes('Admin')) {
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
