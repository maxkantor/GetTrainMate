/**
 * Production analytics — Google Analytics 4 via gtag (@/lib/gtag).
 * Do not send PII (email, name, phone, exact address).
 */

import { gaEvent, gaPageView, getMeasurementId, initGa4 } from '@/lib/gtag';

/** Re-export for app bootstrap (same as {@link initGa4}). */
export { getMeasurementId, initGa4 };
export const initAnalytics = initGa4;

export function trackEvent(eventName: string, params?: Record<string, unknown>): void {
  gaEvent(eventName, params);
}

/** Manual SPA page_view (pathname + optional `?query`; uses `document.title` / real URL on the client). */
export function trackPageView(path: string, title?: string): void {
  gaPageView(path, title);
}

/** @deprecated Prefer {@link trackPageView} — identical. */
export function trackSpaPageView(pathname: string, title?: string): void {
  trackPageView(pathname, title);
}

/** Funnel / product events — wire from flows when ready; names are GA4-safe (snake_case). */
export const gaFunnelEvents = {
  signupStarted: (extra?: Record<string, unknown>) => gaEvent('signup_started', extra),
  signupCompleted: (extra?: Record<string, unknown>) => gaEvent('signup_completed', extra),
  emailVerificationSent: (extra?: Record<string, unknown>) => gaEvent('email_verification_sent', extra),
  emailVerified: (extra?: Record<string, unknown>) => gaEvent('email_verified', extra),
  onboardingStarted: (extra?: Record<string, unknown>) => gaEvent('onboarding_started', extra),
  onboardingCompleted: (extra?: Record<string, unknown>) => gaEvent('onboarding_completed', extra),
  findMyMatchesClicked: (extra?: Record<string, unknown>) => gaEvent('find_my_matches_clicked', extra),
  discoverViewed: (extra?: Record<string, unknown>) => gaEvent('discover_viewed', extra),
  getCreditsClicked: (extra?: Record<string, unknown>) => gaEvent('get_credits_clicked', extra),
};

/** Major CTA clicks — use button_name + location, no PII. */
export function trackCTA(buttonName: string, location?: string): void {
  gaEvent('button_click', { button_name: buttonName, location: location ?? 'unknown' });
}

export function trackLead(kind: 'contact' | 'newsletter' | 'other', extra?: Record<string, unknown>): void {
  gaEvent('lead_submit', { lead_type: kind, ...extra });
}

export function trackContactSubmit(subjectCategory: string): void {
  gaEvent('contact_submit', { subject_category: subjectCategory });
}

export function trackSignUp(method: 'email' | 'oauth_google' = 'email'): void {
  gaEvent('sign_up', { method });
}

export function trackLogin(method: 'email' | 'oauth_google' = 'email'): void {
  gaEvent('login', { method });
}

/** AI workout / plan generation (AI Coach). */
export function trackGeneratePlan(kind: string): void {
  gaEvent('generate_plan', { plan_kind: kind });
}

/** Stripe checkout redirect — uses GA4 recommended `begin_checkout`. */
/** Primary “find matches” funnel — GA4 custom event + legacy dimensions for explorations. */
export function trackMatchSearchClicked(eventLabel: string): void {
  gaEvent('match_search_clicked', {
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
  gaEvent('begin_checkout', {
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
  gaEvent('purchase', {
    transaction_id: transactionId,
    value: valueUsd,
    currency,
    items: packKey ? [{ item_id: packKey, price: valueUsd }] : undefined,
  });
}

export function trackSubscriptionStart(planLabel: string): void {
  gaEvent('subscription_start', { plan_label: planLabel });
}

export function trackTrialStart(context?: string): void {
  gaEvent('trial_start', { context: context ?? 'app' });
}

/** Premium monetization funnel — no PII; use hashed ids where needed. */
export function trackPremiumAction(
  action: string,
  outcome: 'attempt' | 'success' | 'fail' | 'insufficient_credits',
  extra?: Record<string, unknown>
): void {
  gaEvent('premium_action', { action, outcome, ...extra });
}

/** Legacy helpers — map to GA4 + keep names stable for dashboards. */
export const analytics = {
  ctaClick: (cta: string, location?: string) => trackCTA(cta, location),
  landingEntryCtaClick: () => gaEvent('cta_click', { funnel: 'landing_entry' }),
  landingEntrySetupComplete: (params?: { kind?: string }) => gaEvent('setup_complete', { funnel: 'landing_entry', ...params }),
  landingEntryUnlockClick: (surface: 'overlay' | 'match_card' | 'sticky') =>
    gaEvent('unlock_click', { funnel: 'landing_entry', surface }),
  /** Full credits usage breakdown modal (from header, pricing, etc.). */
  creditsUsageOpened: (source?: string) => gaEvent('view_credits_usage', { source: source ?? 'unknown' }),
  pricingOpened: (source?: string) => gaEvent('view_pricing', { source: source ?? 'direct' }),
  purchaseStarted: (packKey: string) => gaEvent('begin_checkout', { pack_key: packKey }),
  purchaseSuccess: (packKey: string, amount: number) =>
    gaEvent('purchase', { pack_key: packKey, value: amount, currency: 'USD' }),
  chatUnlocked: (matchId: string) => gaEvent('chat_unlock', { match_id_hash: hashId(matchId) }),
};

function hashId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return `h_${(h >>> 0).toString(16)}`;
}
