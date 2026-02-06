import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { authService } from '@/services/authService';
import { billingService, CreditsBalanceDto } from '@/services/billingService';
import { useMe } from '@/hooks/useMe';

/** Credits one-time payment success: show confirmation, poll balance, and refresh app credits so header shows updated total. */
export const BillingSuccessPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [balance, setBalance] = useState<CreditsBalanceDto | null>(null);
  const { refreshMe } = useMe();

  useEffect(() => {
    if (!sessionId) return;
    const load = async () => {
      try {
        const token = await authService.getJWT();
        if (!token) return;
        // Apply credits from this purchase immediately (no webhook timing). Idempotent.
        const confirmed = await billingService.confirmCreditsPurchase(token, sessionId);
        if (confirmed) {
          setBalance(confirmed);
          await refreshMe();
          return;
        }
        const b = await billingService.getCreditsBalance(token);
        setBalance(b);
        await refreshMe();
      } catch {
        /* ignore */
      }
    };
    load();
    const t = setInterval(load, 1500);
    return () => clearInterval(t);
  }, [sessionId, refreshMe]);

  return (
    <div style={{ textAlign: 'center', padding: 48, maxWidth: 480, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: 8 }}>Payment received</h1>
      <p style={{ color: '#64748b', marginBottom: 24 }}>
        Your balance is updated as soon as you land on this page. Credits are the same everywhere you’re logged in.
      </p>
      {balance !== null && (
        <p style={{ fontWeight: 600, marginBottom: 24 }}>
          Current balance: <strong>{balance.balance}</strong> credits
        </p>
      )}
      <Link to="/app/subscription" style={{ color: 'var(--color-primary, #6366f1)', fontWeight: 600 }}>
        View balance &amp; get more credits
      </Link>
    </div>
  );
};
