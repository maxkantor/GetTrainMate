import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Container } from '@/components/layout/Container';
import { authService } from '@/services/authService';
import { profileService } from '@/services/profileService';
import { billingService, CreditPackDto } from '@/services/billingService';
import { useAuthContext } from '@/hooks/useAuthContext';
import { DEFAULT_CREDIT_PACKS, CREDIT_FEATURES } from '@/data/creditPacks';
import styles from '@/pages/Pricing.module.css';

const DEFAULT_PACKS: CreditPackDto[] = DEFAULT_CREDIT_PACKS.map((p) => ({
  key: p.key,
  title: p.title,
  priceUsd: p.priceUsd,
  credits: p.credits,
  isActive: true,
  sortOrder: p.sortOrder,
  isBestValue: p.isBestValue,
}));

export const PricingPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, user } = useAuthContext();
  const [packs, setPacks] = useState<CreditPackDto[]>(DEFAULT_PACKS);
  const [error, setError] = useState<string | null>(null);
  const [loadingPack, setLoadingPack] = useState<string | null>(null);

  useEffect(() => {
    billingService.getCreditPacks().then((res) => {
      const arr = res?.packs ?? [];
      const merged =
        arr.length >= 4
          ? [...arr].sort((a, b) => a.sortOrder - b.sortOrder)
          : DEFAULT_PACKS;
      setPacks(merged);
    }).catch(() => setPacks(DEFAULT_PACKS));
  }, []);

  useEffect(() => {
    const canceled = searchParams.get('canceled');
    if (canceled === '1') {
      setError('Checkout was canceled.');
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const startCheckout = useCallback(async (packKey: string) => {
    setError(null);
    setLoadingPack(packKey);
    try {
      const token = await authService.getJWT();
      if (!token) {
        window.location.href = '/signup';
        return;
      }
      const url = await billingService.createCheckoutSession(token, packKey);
      window.location.assign(url);
    } catch (err: unknown) {
      const res = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: string }; status?: number } }).response
        : null;
      const msg = res?.data?.error ?? (err instanceof Error ? err.message : 'Checkout failed');
      setError(typeof msg === 'string' ? msg : 'Checkout failed. Try again later.');
    } finally {
      setLoadingPack(null);
    }
  }, []);

  const handleFree = useCallback(async () => {
    if (!isAuthenticated || !user) {
      window.location.href = '/signup';
      return;
    }
    setError(null);
    setLoadingPack('FREE_3');
    try {
      const token = await authService.getJWT();
      if (!token) {
        window.location.href = '/signup';
        return;
      }
      await billingService.grantFreeSignup(token);
      window.location.href = '/app/discover';
    } catch {
      setError('Could not grant free credits. Try again.');
      setLoadingPack(null);
    }
  }, [isAuthenticated, user]);

  const handlePaid = useCallback((packKey: string) => {
    if (packKey === 'FREE_3') {
      handleFree();
      return;
    }
    if (!isAuthenticated || !user) {
      window.location.href = '/signup';
      return;
    }
    startCheckout(packKey);
  }, [isAuthenticated, user, handleFree, startCheckout]);

  const sortedPacks = [...packs].sort((a, b) => a.sortOrder - b.sortOrder).filter((p) => p.isActive);

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <Container>
          <h1 className={styles.title}>Credits for Training Together</h1>
          <p className={styles.subtext}>
            Get credits to unlock chat, boost visibility, and get AI insights. Start free or buy a pack.
          </p>
        </Container>
      </section>

      {error && (
        <div className={styles.errorBanner} role="alert">
          {error}
        </div>
      )}

      <section id="pricing-plans" className={styles.section}>
        <Container size="xl">
          <div className={styles.cards}>
            {sortedPacks.map((pack) => {
              const isFree = pack.key === 'FREE_3';
              const isBestValue = pack.isBestValue;
              const isLoading = loadingPack === pack.key;
              const ctaLabel = isFree ? 'Start Free' : 'Buy Credits';

              return (
                <div
                  key={pack.key}
                  className={`${styles.card} ${isBestValue ? styles.cardPro : ''} ${pack.key === 'PACK_100' ? styles.cardElite : ''}`}
                >
                  {isBestValue && <span className={styles.badge}>Best Value</span>}
                  <h3 className={styles.planName}>{pack.title}</h3>
                  <div className={styles.price}>
                    <span className={styles.currency}>$</span>
                    <span className={styles.amount}>{pack.priceUsd.toFixed(2)}</span>
                    {!isFree && <span className={styles.period}> one-time</span>}
                    {isFree && <span className={styles.period}></span>}
                  </div>
                  <p className={styles.creditsLabel}>{pack.credits} credits</p>
                  <ul className={styles.features}>
                    {CREDIT_FEATURES.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className={isBestValue ? styles.btnPrimary : styles.btnSecondary}
                    onClick={() => handlePaid(pack.key)}
                    disabled={!!loadingPack}
                  >
                    {isLoading ? 'Redirecting…' : ctaLabel}
                  </button>
                </div>
              );
            })}
          </div>
          <div className={styles.trustRow}>
            <span className={styles.trustItem}>
              <svg className={styles.trustIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Secure payments
            </span>
            <span className={styles.trustItem}>
              <svg className={styles.trustIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              Credits never expire
            </span>
            <span className={styles.trustItem}>
              <svg className={styles.trustIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
              </svg>
              Instant delivery
            </span>
          </div>
        </Container>
      </section>
    </main>
  );
};
