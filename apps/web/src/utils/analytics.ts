/**
 * Analytics event stubs – implement with your provider (GA4, Mixpanel, etc.)
 */
export function track(event: string, props?: Record<string, unknown>): void {
  if (import.meta.env.DEV) {
    console.debug('[analytics]', event, props ?? {});
  }
  // Example: window.gtag?.('event', event, props);
}

export const analytics = {
  ctaClick: (cta: string, location?: string) => track('cta_click', { cta, location }),
  pricingOpened: (source?: string) => track('pricing_opened', { source }),
  purchaseStarted: (packKey: string) => track('purchase_started', { packKey }),
  purchaseSuccess: (packKey: string, amount: number) => track('purchase_success', { packKey, amount }),
  chatUnlocked: (matchId: string) => track('chat_unlocked', { matchId }),
};
