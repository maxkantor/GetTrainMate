/**
 * Production analytics — Google Analytics 4 via gtag (@/lib/gtag).
 * Do not send PII (email, name, phone, exact address).
 */

import { gaEvent, gaPageView } from '@/lib/gtag';

export function trackEvent(eventName: string, params?: Record<string, unknown>): void {
  gaEvent(eventName, params);
}

export function trackSpaPageView(pathname: string, title?: string): void {
  gaPageView(pathname, title);
}

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

/** Legacy helpers — map to GA4 + keep names stable for dashboards. */
export const analytics = {
  ctaClick: (cta: string, location?: string) => trackCTA(cta, location),
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
