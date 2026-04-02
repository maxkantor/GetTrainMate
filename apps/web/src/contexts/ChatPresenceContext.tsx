import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

interface ChatPresenceContextValue {
  /** Thread id when the user has the chat screen focused on that conversation. */
  activeChatThreadId: string | null;
  setActiveChatThreadId: (threadId: string | null) => void;
}

const ChatPresenceContext = createContext<ChatPresenceContextValue | null>(null);

export const ChatPresenceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeChatThreadId, setActiveChatThreadIdState] = useState<string | null>(null);
  const setActiveChatThreadId = useCallback((threadId: string | null) => {
    setActiveChatThreadIdState(threadId);
  }, []);

  const value = useMemo(
    () => ({ activeChatThreadId, setActiveChatThreadId }),
    [activeChatThreadId, setActiveChatThreadId]
  );

  return <ChatPresenceContext.Provider value={value}>{children}</ChatPresenceContext.Provider>;
};

export function useChatPresence(): ChatPresenceContextValue {
  const ctx = useContext(ChatPresenceContext);
  if (!ctx) {
    return { activeChatThreadId: null, setActiveChatThreadId: () => {} };
  }
  return ctx;
}
