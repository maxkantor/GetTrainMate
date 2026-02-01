import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

/** Redirect to subscription page with session_id for status display */
export const BillingSuccessPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    const target = sessionId
      ? `/app/subscription?session_id=${sessionId}&success=true`
      : '/app/subscription';
    navigate(target, { replace: true });
  }, [sessionId, navigate]);

  return (
    <div style={{ textAlign: 'center', padding: 48 }}>
      <p>Processing your subscription…</p>
    </div>
  );
};
