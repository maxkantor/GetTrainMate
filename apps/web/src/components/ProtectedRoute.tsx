import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { useAuthContext } from '@/hooks/useAuthContext';

interface ProtectedRouteProps {
  isAdmin?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ isAdmin = false }) => {
  const { isAuthenticated, isLoading, user } = useAuthContext();

  // Debug logging
  console.log('ProtectedRoute:', { isAuthenticated, isLoading, isAdmin, user: user?.email });

  if (isLoading) {
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
    return <Navigate to="/login" replace />;
  }

  if (isAdmin && !user?.groups?.includes('Admin')) {
    console.log('ProtectedRoute: Not admin, redirecting to /app/discover');
    return <Navigate to="/app/discover" replace />;
  }

  console.log('ProtectedRoute: Authenticated, rendering Outlet');
  return <Outlet />;
};
