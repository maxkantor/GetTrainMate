import React, { createContext, useState, useEffect, useCallback } from 'react';
import { useAuthContext } from '@/hooks/useAuthContext';
import { authService } from '@/services/authService';
import { meService, type MeResponse } from '@/services/meService';
import { isGraphQLEnabled, graphqlGetMe, graphqlEnsureFreeStartCredits, GraphQLApiError } from '@/services/graphqlService';
import { handleApiError, getErrorMessage } from '@/utils/apiErrorHandler';

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
        // Fire-and-forget: ensure free credits; do NOT call fetchMe() again (causes infinite loop)
        graphqlEnsureFreeStartCredits().catch(() => {});
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
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number }; status?: number }).response?.status ?? (err as { status?: number }).status;
      const graphqlErrors = err instanceof GraphQLApiError ? err.graphqlErrors : undefined;
      if (import.meta.env.DEV) {
        console.error('[MeContext] /me failed:', status ?? 'no status', graphqlErrors ?? (err instanceof Error ? err.message : err));
        if (status == null && err != null && typeof err === 'object') {
          const keys = Object.keys(err as object).filter((k) => !k.startsWith('_'));
          console.error('[MeContext] raw error shape (for debugging):', keys, err instanceof Error ? err.message : (err as { message?: string }).message);
        }
      }
      const message = getErrorMessage(err);
      setError(message);
      setMe(null);
      if (import.meta.env.DEV) console.log('[MeContext] Profile fetch failed (not redirecting to onboarding):', message);
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
