import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CreditsUsageModal } from '@/components/credits/CreditsUsageModal';

type CreditsUsageContextValue = {
  openModal: (source?: string) => void;
  closeModal: () => void;
};

const CreditsUsageModalContext = createContext<CreditsUsageContextValue | null>(null);

export const CreditsUsageModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<string>('unknown');

  const openModal = useCallback((src?: string) => {
    setSource(src ?? 'unknown');
    setOpen(true);
  }, []);

  const closeModal = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({
      openModal,
      closeModal,
    }),
    [openModal, closeModal]
  );

  return (
    <CreditsUsageModalContext.Provider value={value}>
      {children}
      <CreditsUsageModal open={open} onClose={closeModal} source={source} />
    </CreditsUsageModalContext.Provider>
  );
};

export function useCreditsUsageModal(): CreditsUsageContextValue {
  const ctx = useContext(CreditsUsageModalContext);
  if (!ctx) {
    throw new Error('useCreditsUsageModal must be used within CreditsUsageModalProvider');
  }
  return ctx;
}
