import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useMe } from '@/hooks/useMe';
import { profileHasRealPhoto } from '@/utils/profilePhotos';

/**
 * After preferences are saved, a real profile photo is required before using the rest of the app.
 * New users may stay on /app for Quick Setup; once they have name + sports without a photo they are sent to upload.
 */
export const PhotoRequiredGate: React.FC = () => {
  const { me, loading } = useMe();
  const location = useLocation();

  if (loading || !me) {
    return <Outlet />;
  }

  if (profileHasRealPhoto(me.profile)) {
    return <Outlet />;
  }

  const path = location.pathname.replace(/\/$/, '') || '/';
  const onProfileEdit = path === '/app/profile';
  const onAppHome = path === '/app' || path === '/app/dashboard';
  const startedSetup =
    Boolean(me.profile?.name?.trim()) && (me.profile?.sportTags?.length ?? 0) > 0;

  if (onProfileEdit) {
    return <Outlet />;
  }

  // Brand-new accounts: allow dashboard Quick Setup before photo.
  if (onAppHome && !startedSetup) {
    return <Outlet />;
  }

  return <Navigate to="/app/profile?focus=photos&required=1" replace />;
};
