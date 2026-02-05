import React, { createContext, useState, useEffect, useCallback } from 'react';
import { useAuthContext } from '@/hooks/useAuthContext';
import { authService } from '@/services/authService';
import { meService, type MeResponse } from '@/services/meService';
import { isGraphQLEnabled, graphqlGetMe, graphqlEnsureFreeStartCredits } from '@/services/graphqlService';

interface MeContextType {
  me: MeResponse | null;
  loading: boolean;
  error: string | null;
  refreshMe: () => Promise<void>;
}

export const MeContext = createContext<MeContextType>({
  me: null,
  loading: true,
  error: null,
  refreshMe: async () => {},
});

interface MeProviderProps {
  children: React.ReactNode;
}

function mapGraphQLMeToResponse(g: Awaited<ReturnType<typeof graphqlGetMe>>): MeResponse {
  const profile = g.profile
    ? {
        userId: (g.profile as { userId?: string }).userId ?? '',
        email: '',
        name: (g.profile as { displayName?: string }).displayName ?? '',
        city: (g.profile as { city?: string }).city,
        bio: (g.profile as { bio?: string }).bio,
        sportTags: ((g.profile as { sports?: string[] }).sports as string[]) ?? [],
        level: (g.profile as { level?: string }).level,
        goals: ((g.profile as { goals?: string[] }).goals as string[]) ?? [],
        availabilitySchedule: ((g.profile as { schedule?: unknown[] }).schedule as { days: string[]; timeStart: string; timeEnd: string }[]) ?? [],
        mode: 'TRAIN' as const,
        photoUrls: (g.profile as { avatarUrl?: string }).avatarUrl ? [(g.profile as { avatarUrl: string }).avatarUrl] : [],
        isComplete: g.isProfileComplete,
        updatedAt: (g.profile as { updatedAt?: string }).updatedAt,
      }
    : null;
  return {
    user: { id: g.user.id, email: g.user.email ?? '' },
    profile,
    credits: g.credits,
    isProfileComplete: g.isProfileComplete,
    isAdmin: g.user.isAdmin ?? false,
  };
}

export const MeProvider: React.FC<MeProviderProps> = ({ children }) => {
  const { isAuthenticated } = useAuthContext();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMe = useCallback(async () => {
    if (!isAuthenticated) {
      setMe(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      if (isGraphQLEnabled) {
        const data = await graphqlGetMe();
        setMe(mapGraphQLMeToResponse(data));
        if (import.meta.env.DEV) {
          console.log('[MeContext] Profile loaded:', (data as { user?: { id?: string } }).user?.id, 'onboarding required:', !(data as { isProfileComplete?: boolean }).isProfileComplete);
        }
        graphqlEnsureFreeStartCredits().then(() => fetchMe()).catch(() => {});
      } else {
        const token = await authService.getJWT();
        if (!token) {
          setMe(null);
          setLoading(false);
          if (import.meta.env.DEV) console.log('[MeContext] No token, profile not loaded');
          return;
        }
        const data = await meService.getMe(token);
        setMe(data);
        if (import.meta.env.DEV) {
          console.log('[MeContext] Profile loaded:', data.user?.id, 'onboarding required:', !data.isProfileComplete);
        }
      }
    } catch (err) {
      console.error('Error fetching /me:', err);
      const errMessage = err instanceof Error ? err.message : 'Failed to load account';
      setError(errMessage);
      setMe(null);
      if (import.meta.env.DEV) console.log('[MeContext] Profile fetch failed (not redirecting to onboarding):', errMessage);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const refreshMe = useCallback(async () => {
    await fetchMe();
  }, [fetchMe]);

  const value: MeContextType = {
    me,
    loading,
    error,
    refreshMe,
  };

  return <MeContext.Provider value={value}>{children}</MeContext.Provider>;
};
