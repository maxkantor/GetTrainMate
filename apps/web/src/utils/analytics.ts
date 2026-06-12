/**
 * Production analytics — Google Analytics 4 via gtag (@/lib/gtag).
 * Dual-writes product events to the API for admin activity monitoring.
 * Do not send PII (email, name, phone, exact address).
 */

import { gaEvent, gaPageView, getMeasurementId, initGa4 } from '@/lib/gtag';
import { API_BASE_URL } from '@/config/api';

const SESSION_KEY = 'gtm_analytics_session';
let cachedAuthToken: string | null = null;
let tokenFetchedAt = 0;

function isAdminPath(path: string): boolean {
  return /^\/admin(?:\/|$)/i.test(path);
}

function normalizeAnalyticsPath(path: string): string {
  if (!path) return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

function shouldTrackCurrentPath(): boolean {
  if (typeof window === 'undefined') return true;
  return !isAdminPath(window.location.pathname || '/');
}

/** Re-export for app bootstrap (same as {@link initGa4}). */
export { getMeasurementId, initGa4 };
export const initAnalytics = initGa4;

function getAnalyticsSessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `s_${Date.now()}`;
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return `s_${Date.now()}`;
  }
}

function currentPathForBeacon(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return `${window.location.pathname}${window.location.search}`;
}

/** Fire-and-forget server beacon for admin CRM activity feed. */
function queueServerEvent(
  eventType: string,
  params: Record<string, unknown> = {},
  path?: string
): void {
  void (async () => {
    try {
      const now = Date.now();
      if (now - tokenFetchedAt > 60_000) {
        try {
          const { authService } = await import('@/services/authService');
          cachedAuthToken = await authService.getJWT();
          tokenFetchedAt = now;
        } catch {
          cachedAuthToken = null;
        }
      }

      await fetch(`${API_BASE_URL}/api/activity/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cachedAuthToken ? { Authorization: `Bearer ${cachedAuthToken}` } : {}),
        },
        body: JSON.stringify({
          eventType,
          path: path ?? currentPathForBeacon(),
          sessionId: getAnalyticsSessionId(),
          params,
        }),
        keepalive: true,
      });
    } catch {
      /* offline — ignore */
    }
  })();
}

function emitAnalyticsEvent(
  eventName: string,
  params: Record<string, unknown> = {},
  path?: string
): void {
  if (!shouldTrackCurrentPath()) return;
  gaEvent(eventName, params);
  queueServerEvent(eventName, params, path);
}

export function trackEvent(eventName: string, params: Record<string, unknown> = {}): void {
  emitAnalyticsEvent(eventName, params);
}

/** Manual SPA page_view (pathname + optional `?query`; uses `document.title` / real URL on the client). */
export function trackPageView(path: string, title?: string): void {
  const safePath = normalizeAnalyticsPath(path);
  if (isAdminPath(safePath)) return;
  gaPageView(safePath, title);
  queueServerEvent(
    'page_view',
    { page_title: title ?? (typeof document !== 'undefined' ? document.title : undefined) },
    safePath
  );
}

/** @deprecated Prefer {@link trackPageView} — identical. */
export function trackSpaPageView(pathname: string, title?: string): void {
  trackPageView(pathname, title);
}

/** Funnel / product events — wire from flows when ready; names are GA4-safe (snake_case). */
export const gaFunnelEvents = {
  signupStarted: (extra?: Record<string, unknown>) => emitAnalyticsEvent('signup_started', extra ?? {}),
  signupCompleted: (extra?: Record<string, unknown>) => emitAnalyticsEvent('signup_completed', extra ?? {}),
  emailVerificationSent: (extra?: Record<string, unknown>) => emitAnalyticsEvent('email_verification_sent', extra ?? {}),
  emailVerified: (extra?: Record<string, unknown>) => emitAnalyticsEvent('email_verified', extra ?? {}),
  onboardingStarted: (extra?: Record<string, unknown>) => emitAnalyticsEvent('onboarding_started', extra ?? {}),
  onboardingCompleted: (extra?: Record<string, unknown>) => emitAnalyticsEvent('onboarding_completed', extra ?? {}),
  findMyMatchesClicked: (extra?: Record<string, unknown>) => emitAnalyticsEvent('find_my_matches_clicked', extra ?? {}),
  discoverViewed: (extra?: Record<string, unknown>) => emitAnalyticsEvent('discover_viewed', extra ?? {}),
  getCreditsClicked: (extra?: Record<string, unknown>) => emitAnalyticsEvent('get_credits_clicked', extra ?? {}),
};

/** Major CTA clicks — use button_name + location, no PII. */
export function trackCTA(buttonName: string, location?: string): void {
  emitAnalyticsEvent('button_click', { button_name: buttonName, location: location ?? 'unknown' });
}

export function trackLead(kind: 'contact' | 'newsletter' | 'other', extra?: Record<string, unknown>): void {
  emitAnalyticsEvent('lead_submit', { lead_type: kind, ...extra });
}

export function trackContactSubmit(subjectCategory: string): void {
  emitAnalyticsEvent('contact_submit', { subject_category: subjectCategory });
}

export function trackSignUp(method: 'email' | 'oauth_google' = 'email'): void {
  emitAnalyticsEvent('sign_up', { method });
}

export function trackLogin(method: 'email' | 'oauth_google' = 'email'): void {
  emitAnalyticsEvent('login', { method });
}

/** AI workout / plan generation (AI Coach). */
export function trackGeneratePlan(kind: string): void {
  emitAnalyticsEvent('generate_plan', { plan_kind: kind });
}

/** Stripe checkout redirect — uses GA4 recommended `begin_checkout`. */
/** Primary “find matches” funnel — GA4 custom event + legacy dimensions for explorations. */
export function trackMatchSearchClicked(eventLabel: string): void {
  emitAnalyticsEvent('match_search_clicked', {
    event_category: 'engagement',
    event_label: eventLabel,
  });
}

export function trackBeginCheckout(params: {
  packKey: string;
  itemName: string;
  valueUsd: number;
  currency?: string;
}): void {
  const { packKey, itemName, valueUsd, currency = 'USD' } = params;
  emitAnalyticsEvent('begin_checkout', {
    currency,
    value: valueUsd,
    items: [{ item_id: packKey, item_name: itemName, price: valueUsd }],
  });
}

/** After successful credit purchase (e.g. return from Stripe). */
export function trackPurchase(params: {
  transactionId: string;
  valueUsd: number;
  packKey?: string;
  currency?: string;
}): void {
  const { transactionId, valueUsd, packKey, currency = 'USD' } = params;
  emitAnalyticsEvent('purchase', {
    transaction_id: transactionId,
    value: valueUsd,
    currency,
    items: packKey ? [{ item_id: packKey, price: valueUsd }] : undefined,
  });
}

export function trackSubscriptionStart(planLabel: string): void {
  emitAnalyticsEvent('subscription_start', { plan_label: planLabel });
}

export function trackTrialStart(context?: string): void {
  emitAnalyticsEvent('trial_start', { context: context ?? 'app' });
}

/** Premium monetization funnel — no PII; use hashed ids where needed. */
export function trackPremiumAction(
  action: string,
  outcome: 'attempt' | 'success' | 'fail' | 'insufficient_credits',
  extra?: Record<string, unknown>
): void {
  emitAnalyticsEvent('premium_action', { action, outcome, ...extra });
}

export function trackSportsEventAnalytics(
  eventName:
    | 'event_banner_view'
    | 'event_banner_click'
    | 'event_page_view'
    | 'event_activity_click'
    | 'event_profile_badge_view'
    | 'event_meetup_create_start'
    | 'event_meetup_created'
    | 'event_boost_click'
    | 'event_credit_prompt_view',
  params: {
    eventId?: string;
    eventLabel?: string;
    sport?: string;
    activityType?: string;
    sourcePage?: string;
  }
): void {
  emitAnalyticsEvent(eventName, params);
}

/** Legacy helpers — map to GA4 + keep names stable for dashboards. */
export const analytics = {
  ctaClick: (cta: string, location?: string) => trackCTA(cta, location),
  landingEntryCtaClick: () => emitAnalyticsEvent('cta_click', { funnel: 'landing_entry' }),
  landingEntrySetupComplete: (params?: { kind?: string }) =>
    emitAnalyticsEvent('setup_complete', { funnel: 'landing_entry', ...params }),
  landingEntryUnlockClick: (surface: 'overlay' | 'match_card' | 'sticky') =>
    emitAnalyticsEvent('unlock_click', { funnel: 'landing_entry', surface }),
  /** Full credits usage breakdown modal (from header, pricing, etc.). */
  creditsUsageOpened: (source?: string) => emitAnalyticsEvent('view_credits_usage', { source: source ?? 'unknown' }),
  pricingViewed: (source?: string) => emitAnalyticsEvent('pricing_viewed', { source: source ?? 'unknown' }),
  pricingClicked: (source?: string) => emitAnalyticsEvent('pricing_viewed', { source: source ?? 'unknown' }),
  pricingOpened: (source?: string) => emitAnalyticsEvent('view_pricing', { source: source ?? 'direct' }),
  purchaseStarted: (packKey: string) => emitAnalyticsEvent('begin_checkout', { pack_key: packKey }),
  purchaseSuccess: (packKey: string, amount: number) =>
    emitAnalyticsEvent('purchase', { pack_key: packKey, value: amount, currency: 'USD' }),
  chatUnlocked: (matchId: string) => emitAnalyticsEvent('chat_unlock', { match_id_hash: hashId(matchId) }),
};

function hashId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return `h_${(h >>> 0).toString(16)}`;
}
