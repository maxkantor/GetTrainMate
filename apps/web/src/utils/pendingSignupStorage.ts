const KEY = 'gtm_pending_signup';
const TTL_MS = 60 * 60 * 1000; // 1 hour

export type PendingSignupPayload = {
  email: string;
  username: string;
  password: string;
  fullName: string;
  createdAt: number;
};

export function savePendingSignup(data: Omit<PendingSignupPayload, 'createdAt'>): void {
  try {
    const payload: PendingSignupPayload = {
      ...data,
      createdAt: Date.now(),
    };
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function readPendingSignup(): PendingSignupPayload | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingSignupPayload;
    if (!p?.email || !p?.username || !p?.password) return null;
    if (Date.now() - (p.createdAt ?? 0) > TTL_MS) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

export function clearPendingSignup(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

const WELCOME_KEY = 'gtm_post_verify_welcome';

export function markPostVerifyWelcome(): void {
  try {
    sessionStorage.setItem(WELCOME_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function consumePostVerifyWelcome(): boolean {
  try {
    if (sessionStorage.getItem(WELCOME_KEY) !== '1') return false;
    sessionStorage.removeItem(WELCOME_KEY);
    return true;
  } catch {
    return false;
  }
}
