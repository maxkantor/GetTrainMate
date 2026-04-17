const KEY = 'gtm_pending_signup';
/** Long enough for email delivery + refresh during verification */
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const NEW_USER_DASHBOARD_KEY = 'gtm_new_user_dashboard';
const SIGNUP_DISPLAY_NAME_KEY = 'gtm_signup_display_name';

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

/** After email verification — show first-time dashboard copy until profile onboarding is done. */
export function setNewUserDashboardGreeting(): void {
  try {
    localStorage.setItem(NEW_USER_DASHBOARD_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function peekNewUserDashboardGreeting(): boolean {
  try {
    return localStorage.getItem(NEW_USER_DASHBOARD_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearNewUserDashboardGreeting(): void {
  try {
    localStorage.removeItem(NEW_USER_DASHBOARD_KEY);
  } catch {
    /* ignore */
  }
}

/** Full name from signup form — used for quick setup until saved to profile. */
export function rememberSignupDisplayName(name: string): void {
  const n = name?.trim();
  if (!n) return;
  try {
    localStorage.setItem(SIGNUP_DISPLAY_NAME_KEY, n.slice(0, 80));
  } catch {
    /* ignore */
  }
}

export function readSignupDisplayName(): string | null {
  try {
    const v = localStorage.getItem(SIGNUP_DISPLAY_NAME_KEY)?.trim();
    return v || null;
  } catch {
    return null;
  }
}

export function clearSignupDisplayName(): void {
  try {
    localStorage.removeItem(SIGNUP_DISPLAY_NAME_KEY);
  } catch {
    /* ignore */
  }
}
