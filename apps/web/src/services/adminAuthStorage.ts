/** Admin portal session (password login — not Cognito). */

export const ADMIN_SESSION_KEY = 'admin_session';

export interface AdminSessionPayload {
  sessionToken: string;
  expiresAt: string;
  email: string;
}

export function getAdminSession(): AdminSessionPayload | null {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as AdminSessionPayload;
    if (!s.sessionToken || !s.expiresAt) return null;
    if (new Date(s.expiresAt) <= new Date()) {
      clearAdminSession();
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

/** Token for X-Admin-Token (same as sessionToken from login). */
export function getAdminToken(): string | null {
  const legacy = localStorage.getItem('adminToken');
  if (legacy) return legacy;
  return getAdminSession()?.sessionToken ?? null;
}

export function setAdminSession(payload: AdminSessionPayload): void {
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(payload));
  localStorage.setItem('adminToken', payload.sessionToken);
}

export function clearAdminSession(): void {
  localStorage.removeItem(ADMIN_SESSION_KEY);
  localStorage.removeItem('adminToken');
  localStorage.removeItem('admin_password_cache');
}
