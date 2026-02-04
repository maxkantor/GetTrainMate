import React, { createContext, useState, useEffect, useCallback } from 'react';
import { useAuthContext } from '@/hooks/useAuthContext';
import { authService } from '@/services/authService';
import { meService, type MeResponse } from '@/services/meService';

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
      const token = await authService.getJWT();
      if (!token) {
        setMe(null);
        setLoading(false);
        return;
      }
      const data = await meService.getMe(token);
      setMe(data);
    } catch (err) {
      console.error('Error fetching /me:', err);
      setError(err instanceof Error ? err.message : 'Failed to load account');
      setMe(null);
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
