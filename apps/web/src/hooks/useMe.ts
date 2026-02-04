import { useContext } from 'react';
import { MeContext } from '@/contexts/MeContext';

export function useMe() {
  const context = useContext(MeContext);
  if (!context) {
    throw new Error('useMe must be used within MeProvider');
  }
  return context;
}
