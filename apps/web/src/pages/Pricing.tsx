import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Snackbar } from '@mui/material';
import { Container } from '@/components/layout/Container';
import { authService } from '@/services/authService';
import { billingService, CreditPackDto } from '@/services/billingService';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useMe } from '@/hooks/useMe';
import {
  CreditPack,
  FALLBACK_CREDIT_PACKS,
  CREDIT_PACK_FEATURES,
  CreditPackKey,
} from '@/data/creditPacks';
import styles from '@/pages/Pricing.module.css';

const KNOWN_KEYS: CreditPackKey[] = ['FREE_3', 'PACK_10', 'PACK_25', 'PACK_100'];

function mapApiToCreditPack(dto: CreditPackDto): CreditPack {
  const key: CreditPackKey = KNOWN_KEYS.includes(dto.key as CreditPackKey)
    ? (dto.key as CreditPackKey)
    : 'FREE_3';
  const fallback = FALLBACK_CREDIT_PACKS.find((p) => p.key === key);
  return {
    key,
    title: dto.title || fallback?.title || key,
    priceUsd: dto.priceUsd ?? fallback?.priceUsd ?? 0,
    credits: dto.credits ?? fallback?.credits ?? 0,
    sortOrder: dto.sortOrder ?? fallback?.sortOrder ?? 0,
    isBestValue: dto.isBestValue ?? fallback?.isBestValue ?? false,
    isFree: key === 'FREE_3',
  };
}

function toCreditPacks(dtos: CreditPackDto[]): CreditPack[] {
  if (!dtos?.length) return FALLBACK_CREDIT_PACKS;
  return dtos
    .filter((d) => KNOWN_KEYS.includes(d.key as CreditPackKey) && (d.isActive !== false))
    .map(mapApiToCreditPack)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export const PricingPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, user } = useAuthContext();
  const { me } = useMe();
  const [packs, setPacks] = useState<CreditPack[]>(FALLBACK_CREDIT_PACKS);
  const [error, setError] = useState<string | null>(null);
  const [loadingPack, setLoadingPack] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    billingService
      .getCreditPacks()
      .then((res) => {
        const arr = res?.packs ?? [];
        setPacks(toCreditPacks(arr));
      })
      .catch(() => setPacks(FALLBACK_CREDIT_PACKS));
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
      const res =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response
          : null;
      const msg =
        res?.data?.error ?? (err instanceof Error ? err.message : 'Checkout failed');
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
      setToast('3 credits added');
    } catch {
      setError('Could not grant free credits. Try again.');
    } finally {
      setLoadingPack(null);
    }
  }, [isAuthenticated, user]);

  const handleCta = useCallback(
    (pack: CreditPack) => {
      if (pack.key === 'FREE_3') {
        handleFree();
        return;
      }
      if (!isAuthenticated || !user) {
        window.location.href = '/signup';
        return;
      }
      startCheckout(pack.key);
    },
    [isAuthenticated, user, handleFree, startCheckout]
  );

  const sortedPacks = [...packs].sort((a, b) => a.sortOrder - b.sortOrder);

  const credits = me?.credits ?? 0;

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <Container>
          {isAuthenticated && (
            <p className={styles.yourCredits} data-testid="pricing-your-credits">
              Your credits: <strong>{credits}</strong>
            </p>
          )}
          <h1 className={styles.title}>Credits Marketplace</h1>
          <p className={styles.subtext}>
            Get credits to unlock chat, boosts, and AI insights. Start free or buy a pack.
          </p>
          <p className={styles.typicalCosts}>
            Typical costs: Chat unlock = 1 credit · Boost (24h) = 2 · AI insight = 2 · See likes (7d) = 3
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
              const isFree = pack.isFree;
              const isBestValue = pack.isBestValue;
              const isLoading = loadingPack === pack.key;
              const features = CREDIT_PACK_FEATURES[pack.key] ?? [];
              const ctaLabel = isFree ? 'Start Free' : 'Buy Credits';

              return (
                <div
                  key={pack.key}
                  className={`${styles.card} ${isBestValue ? styles.cardBestValue : ''}`}
                >
                  {isBestValue && <span className={styles.badge}>Best Value</span>}
                  <h3 className={styles.planName}>{pack.title}</h3>
                  <div className={styles.price}>
                    <span className={styles.currency}>$</span>
                    <span className={styles.amount}>{pack.priceUsd.toFixed(2)}</span>
                    {!isFree && <span className={styles.period}> one-time</span>}
                  </div>
                  <p className={styles.creditsLabel}>{pack.credits} credits</p>
                  <ul className={styles.features}>
                    {features.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className={isBestValue ? styles.btnPrimary : styles.btnSecondary}
                    onClick={() => handleCta(pack)}
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

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </main>
  );
};
