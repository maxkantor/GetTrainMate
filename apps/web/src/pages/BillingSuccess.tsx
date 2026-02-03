import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { authService } from '@/services/authService';
import { billingService, CreditsBalanceDto } from '@/services/billingService';

/** Credits one-time payment success: show confirmation and optionally poll balance. */
export const BillingSuccessPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [balance, setBalance] = useState<CreditsBalanceDto | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    const load = async () => {
      try {
        const token = await authService.getJWT();
        if (token) {
          const b = await billingService.getCreditsBalance(token);
          setBalance(b);
        }
      } catch {
        /* ignore */
      }
    };
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [sessionId]);

  return (
    <div style={{ textAlign: 'center', padding: 48, maxWidth: 480, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: 8 }}>Payment received</h1>
      <p style={{ color: '#64748b', marginBottom: 24 }}>
        Your credits will appear shortly. You can close this page or go to your account.
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
