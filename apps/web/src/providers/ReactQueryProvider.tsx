import React, { useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useAuthContext } from '@/hooks/useAuthContext';
import { createGtmQueryClient } from '@/lib/queryClient';

let browserClient: QueryClient | undefined;

function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    return createGtmQueryClient();
  }
  if (!browserClient) browserClient = createGtmQueryClient();
  return browserClient;
}

/**
 * Clears the query cache when the signed-in user changes or `gtm-auth-user-changed` fires,
 * so matches/sent/skipped never bleed across accounts.
 */
function AuthQuerySync() {
  const { user } = useAuthContext();
  const sub = user?.sub;
  const qc = useQueryClient();
  const prevSub = useRef<string | undefined>(undefined);

  useEffect(() => {
    const prev = prevSub.current;
    if (prev != null && prev !== sub) {
      qc.clear();
    }
    prevSub.current = sub;
  }, [sub, qc]);

  useEffect(() => {
    const onAuthScopeEvent = () => {
      qc.clear();
    };
    window.addEventListener('gtm-auth-user-changed', onAuthScopeEvent);
    return () => window.removeEventListener('gtm-auth-user-changed', onAuthScopeEvent);
  }, [qc]);

  return null;
}

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  const client = getQueryClient();
  return (
    <QueryClientProvider client={client}>
      <AuthQuerySync />
      {children}
    </QueryClientProvider>
  );
}
