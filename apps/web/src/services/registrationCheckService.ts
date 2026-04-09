import { API_BASE_URL } from '@/config/api';

export type RegistrationEmailCheckResult = {
  available: boolean;
  status: string;
  message?: string | null;
  resendUsername?: string | null;
};

/**
 * Server-side Cognito lookup before signUp — avoids sending duplicate verification emails.
 */
export async function checkRegistrationEmail(email: string): Promise<RegistrationEmailCheckResult> {
  const trimmed = email.trim();
  if (!trimmed) {
    return { available: true, status: 'Skipped', message: null };
  }

  const res = await fetch(`${API_BASE_URL}/api/public/auth/check-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: trimmed }),
  });

  if (!res.ok) {
    return { available: true, status: 'HttpError', message: null };
  }

  return (await res.json()) as RegistrationEmailCheckResult;
}
