import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/** Redirect to pricing when user cancels Stripe checkout. */
export const BillingCancelPage: React.FC = () => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/pricing?canceled=1', { replace: true });
  }, [navigate]);
  return (
    <div style={{ textAlign: 'center', padding: 48 }}>
      <p>Redirecting to pricing…</p>
    </div>
  );
};
