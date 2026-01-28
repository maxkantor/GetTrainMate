import React, { useState, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { useAuthContext } from '@/hooks/useAuthContext';
import { profileService } from '@/services/profileService';
import { authService } from '@/services/authService';

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

  // Check profile completion if required
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
  }, [isAuthenticated, requireProfileComplete]);

  // Debug logging
  console.log('ProtectedRoute:', { 
    isAuthenticated, 
    isLoading, 
    profileLoading,
    profileComplete,
    isAdmin, 
    user: user?.email,
    requireProfileComplete,
  });

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
    console.log('ProtectedRoute: Not authenticated, redirecting to /login');
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (isAdmin && !user?.groups?.includes('Admin')) {
    console.log('ProtectedRoute: Not admin, redirecting to /app/discover');
    return <Navigate to="/app/discover" replace />;
  }

  // Check profile completion for non-admin routes
  if (requireProfileComplete && !profileComplete) {
    console.log('ProtectedRoute: Profile incomplete, redirecting to /onboarding/profile');
    return <Navigate to="/onboarding/profile" replace state={{ from: location }} />;
  }

  console.log('ProtectedRoute: Authenticated and profile complete, rendering Outlet');
  return <Outlet />;
};
