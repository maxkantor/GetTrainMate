import React, { useState, useEffect, useCallback } from 'react';
import { analytics, trackBeginCheckout, trackTrialStart } from '@/utils/analytics';
import { useSearchParams } from 'react-router-dom';
import { Snackbar } from '@mui/material';
import { Container } from '@/components/layout/Container';
import { PageShell } from '@/components/layout/PageShell';
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

const PACK_DISPLAY_TITLES: Record<CreditPackKey, string> = {
  FREE_3: 'Starter',
  PACK_10: 'Go',
  PACK_25: 'Best Value',
  PACK_100: 'Power',
};
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
    analytics.pricingOpened();
  }, []);

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

  const startCheckout = useCallback(async (pack: CreditPack) => {
    setError(null);
    setLoadingPack(pack.key);
    try {
      const token = await authService.getJWT();
      if (!token) {
        window.location.href = '/signup';
        return;
      }
      const itemName = PACK_DISPLAY_TITLES[pack.key] ?? pack.title;
      trackBeginCheckout({
        packKey: pack.key,
        itemName,
        valueUsd: pack.priceUsd,
      });
      const url = await billingService.createCheckoutSession(token, pack.key);
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
      trackTrialStart('free_pack');
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
      startCheckout(pack);
    },
    [isAuthenticated, user, handleFree, startCheckout]
  );

  const sortedPacks = [...packs].sort((a, b) => a.sortOrder - b.sortOrder);

  const credits = me?.credits ?? 0;

  return (
    <>
      <PageShell variant="pricing" showBackLink>
        <section className={styles.hero}>
          <Container>
            {isAuthenticated && (
              <p className={styles.yourCredits} data-testid="pricing-your-credits">
                Your credits: <strong>{credits}</strong>
              </p>
            )}
            <h1 className={styles.title}>Get Credits. Make More Matches.</h1>
            <p className={styles.subtext}>
              Use credits to unlock chats, boost your profile, reveal likes, and get AI-powered compatibility insights — only when you need them.
            </p>
            <p className={styles.supportLine}>
              No subscription. No commitment. Just one-time credit packs.
            </p>
            <div className={styles.explanationRow}>
              <span><strong>1 credit</strong> → unlock chat</span>
              <span><strong>1 credit</strong> → AI icebreaker</span>
              <span><strong>2 credits</strong> → profile boost (24h)</span>
              <span><strong>2 credits</strong> → AI match insight</span>
              <span><strong>3 credits</strong> → reveal likes</span>
              <span><strong>3 credits</strong> → AI workout plan</span>
            </div>
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
              const ctaLabel = isFree ? 'Get Started Free' : pack.key === 'PACK_25' ? 'Get Best Value' : pack.key === 'PACK_100' ? 'Power Up' : 'Buy Credits';

              return (
                <div
                  key={pack.key}
                  className={`${styles.card} ${isBestValue ? styles.cardBestValue : ''}`}
                >
                  {isBestValue && <span className={styles.badge}>Best Value</span>}
                  <h3 className={styles.planName}>{PACK_DISPLAY_TITLES[pack.key] ?? pack.title}</h3>
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
            <span className={styles.trustItem}>
              <svg className={styles.trustIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              One-time purchase, no subscription
            </span>
          </div>

          <section className={styles.featureSection}>
            <h2 className={styles.featureSectionTitle}>What You Can Do With Credits</h2>
            <div className={styles.featureTiles}>
              <div className={styles.featureTile}>
                <div className={styles.featureTileIcon} aria-hidden>💬</div>
                <h3 className={styles.featureTileTitle}>Unlock Chat</h3>
                <p className={styles.featureTileDesc}>Start a conversation with a training partner.</p>
                <span className={styles.featureTileBadge}>Cost: 1 credit</span>
              </div>
              <div className={styles.featureTile}>
                <div className={styles.featureTileIcon} aria-hidden>💡</div>
                <h3 className={styles.featureTileTitle}>AI Icebreaker</h3>
                <p className={styles.featureTileDesc}>Get smart first-message suggestions based on both profiles.</p>
                <span className={styles.featureTileBadge}>Cost: 1 credit</span>
              </div>
              <div className={styles.featureTile}>
                <div className={styles.featureTileIcon} aria-hidden>📈</div>
                <h3 className={styles.featureTileTitle}>Boost Profile</h3>
                <p className={styles.featureTileDesc}>Get more profile views for 24 hours.</p>
                <span className={styles.featureTileBadge}>Cost: 2 credits</span>
              </div>
              <div className={styles.featureTile}>
                <div className={styles.featureTileIcon} aria-hidden>✨</div>
                <h3 className={styles.featureTileTitle}>AI Match Insight</h3>
                <p className={styles.featureTileDesc}>See compatibility based on sport, schedule, goals, and experience.</p>
                <span className={styles.featureTileBadge}>Cost: 2 credits</span>
              </div>
              <div className={styles.featureTile}>
                <div className={styles.featureTileIcon} aria-hidden>❤️</div>
                <h3 className={styles.featureTileTitle}>Reveal Likes</h3>
                <p className={styles.featureTileDesc}>See who already liked your profile.</p>
                <span className={styles.featureTileBadge}>Cost: 3 credits</span>
              </div>
              <div className={styles.featureTile}>
                <div className={styles.featureTileIcon} aria-hidden>📋</div>
                <h3 className={styles.featureTileTitle}>AI Workout Plan</h3>
                <p className={styles.featureTileDesc}>Generate a workout or meetup plan from sport, level, goals, and schedule.</p>
                <span className={styles.featureTileBadge}>Cost: 3 credits</span>
              </div>
            </div>
          </section>

          <section className={styles.whyCreditsSection}>
            <h2 className={styles.whyCreditsTitle}>Why credits work better</h2>
            <ul className={styles.whyCreditsList}>
              <li>Pay only when you use features</li>
              <li>No recurring payments</li>
              <li>Flexible for casual or active users</li>
              <li>Built for real-world training partners</li>
            </ul>
          </section>

          <div className={styles.faq}>
            <h3 className={styles.faqTitle}>Frequently asked</h3>
            <details className={styles.faqItem}>
              <summary>What can I do with credits?</summary>
              <p>Credits unlock chat (1), AI icebreakers (1), profile boost (2), AI match insight (2), reveal likes (3), and AI workout plan (3). No subscription — use only what you need.</p>
            </details>
            <details className={styles.faqItem}>
              <summary>Do credits expire?</summary>
              <p>No. Your credits never expire. Use them whenever you want.</p>
            </details>
            <details className={styles.faqItem}>
              <summary>Can I get a refund?</summary>
              <p>If you haven&apos;t used the credits, contact support within 7 days for a refund. Used credits are non-refundable.</p>
            </details>
          </div>
        </Container>
      </section>
      </PageShell>

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
};
