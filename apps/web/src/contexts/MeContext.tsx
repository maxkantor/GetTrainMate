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
    lifetimeEarned: (g as { lifetimeEarned?: number }).lifetimeEarned ?? g.credits,
    isProfileComplete: g.isProfileComplete,
    isAdmin: g.user.isAdmin ?? false,
  };
}

export const MeProvider: React.FC<MeProviderProps> = ({ children }) => {
  const { isAuthenticated } = useAuthContext();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMe = useCallback(async (silent = false) => {
    if (!isAuthenticated) {
      setMe(null);
      setLoading(false);
      return;
    }
    try {
      if (!silent) setLoading(true);
      setError(null);
      const token = await authService.getJWT();
      if (!token) {
        setMe(null);
        setLoading(false);
        if (import.meta.env.DEV) console.log('[MeContext] No token, profile not loaded');
        return;
      }

      if (isGraphQLEnabled) {
        try {
          const data = await graphqlGetMe();
          setMe(mapGraphQLMeToResponse(data));
          if (import.meta.env.DEV) {
            console.log('[MeContext] Profile loaded (GraphQL):', (data as { user?: { id?: string } }).user?.id, 'onboarding required:', !(data as { isProfileComplete?: boolean }).isProfileComplete);
          }
          graphqlEnsureFreeStartCredits().catch(() => {});
          return;
        } catch (graphqlErr) {
          const status = graphqlErr instanceof GraphQLApiError ? graphqlErr.status : (graphqlErr as { response?: { status?: number }; statusCode?: number })?.response?.status ?? (graphqlErr as { statusCode?: number })?.statusCode;
          const message = graphqlErr instanceof Error ? graphqlErr.message : (graphqlErr as { message?: string })?.message ?? '';
          const graphqlErrors = graphqlErr instanceof GraphQLApiError ? graphqlErr.graphqlErrors : undefined;
          const isUnauthorized =
            status === 401 ||
            message.toLowerCase().includes('unauthorized') ||
            graphqlErrors?.some(
              (e) =>
                (e.message ?? '').toLowerCase().includes('unauthorized') ||
                (e.extensions as Record<string, unknown>)?.errorType === 'Unauthorized' ||
                (e.extensions as Record<string, unknown>)?.code === 'UNAUTHENTICATED'
            );
          if (isUnauthorized && token) {
            if (import.meta.env.DEV) console.log('[MeContext] GraphQL Unauthorized, falling back to REST /api/me');
            try {
              const data = await meService.getMe(token);
              setMe(data);
              if (import.meta.env.DEV) console.log('[MeContext] Profile loaded (REST fallback):', data.user?.id);
              return;
            } catch (restErr) {
              if (import.meta.env.DEV) console.warn('[MeContext] REST fallback also failed:', restErr);
            }
          }
          throw graphqlErr;
        }
      }

      const data = await meService.getMe(token);
      setMe(data);
      if (import.meta.env.DEV) {
        console.log('[MeContext] Profile loaded:', data.user?.id, 'onboarding required:', !data.isProfileComplete);
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
    await fetchMe(true);
  }, [fetchMe]);

  const value: MeContextType = {
    me,
    loading,
    error,
    refreshMe,
  };

  return <MeContext.Provider value={value}>{children}</MeContext.Provider>;
};
