import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { LandingEntryFlow } from '@/components/landing/LandingEntryFlow';

type Ctx = {
  openEntryFlow: () => void;
  closeEntryFlow: () => void;
};

const LandingConversionContext = createContext<Ctx | null>(null);

export function LandingConversionProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const openEntryFlow = useCallback(() => setOpen(true), []);
  const closeEntryFlow = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({ openEntryFlow, closeEntryFlow }),
    [openEntryFlow, closeEntryFlow]
  );

  return (
    <LandingConversionContext.Provider value={value}>
      {children}
      <LandingEntryFlow open={open} onClose={closeEntryFlow} />
    </LandingConversionContext.Provider>
  );
}

export function useLandingConversion(): Ctx {
  const ctx = useContext(LandingConversionContext);
  if (!ctx) {
    return {
      openEntryFlow: () => {
        window.location.assign('/signup');
      },
      closeEntryFlow: () => {
        /* no provider (e.g. tests) */
      },
    };
  }
  return ctx;
}
