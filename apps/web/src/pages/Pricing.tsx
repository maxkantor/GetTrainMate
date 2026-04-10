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
import { useI18n } from '@/hooks/useI18n';
import { formatI18n, getPricingPackFeatures, getPricingPackTitle } from '@/i18n';
import { CreditPack, FALLBACK_CREDIT_PACKS, CreditPackKey } from '@/data/creditPacks';
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
  const { t, locale } = useI18n();
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
      setError(t('pricing.checkout_canceled'));
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, t]);

  const startCheckout = useCallback(async (pack: CreditPack) => {
    setError(null);
    setLoadingPack(pack.key);
    try {
      const token = await authService.getJWT();
      if (!token) {
        window.location.href = '/signup';
        return;
      }
      const itemName = getPricingPackTitle(locale, pack.key);
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
        res?.data?.error ?? (err instanceof Error ? err.message : t('pricing.checkout_failed_short'));
      setError(typeof msg === 'string' ? msg : t('pricing.checkout_failed'));
    } finally {
      setLoadingPack(null);
    }
  }, [locale, t]);

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
      setToast(t('pricing.toast_free_credits'));
    } catch {
      setError(t('pricing.grant_free_error'));
    } finally {
      setLoadingPack(null);
    }
  }, [isAuthenticated, user, t]);

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

  const ctaLabel = (pack: CreditPack) => {
    if (pack.isFree) return t('pricing.cta_free');
    if (pack.key === 'PACK_25') return t('pricing.cta_best_value');
    if (pack.key === 'PACK_100') return t('pricing.cta_power');
    return t('pricing.cta_buy');
  };

  return (
    <>
      <PageShell variant="pricing" showBackLink>
        <section className={styles.hero}>
          <Container>
            {isAuthenticated && (
              <p className={styles.yourCredits} data-testid="pricing-your-credits">
                {t('pricing.your_credits_label')} <strong>{credits}</strong>
              </p>
            )}
            <h1 className={styles.title}>{t('pricing.hero_title')}</h1>
            <p className={styles.subtext}>{t('pricing.hero_sub')}</p>
            <p className={styles.supportLine}>{t('pricing.support_line')}</p>
            <div className={styles.explanationRow}>
              <span>
                <strong>{t('pricing.credit_1')}</strong> {t('pricing.explain_unlock_chat')}
              </span>
              <span>
                <strong>{t('pricing.credit_1')}</strong> {t('pricing.explain_ai_icebreaker')}
              </span>
              <span>
                <strong>{t('pricing.credit_2')}</strong> {t('pricing.explain_boost')}
              </span>
              <span>
                <strong>{t('pricing.credit_2')}</strong> {t('pricing.explain_insight')}
              </span>
              <span>
                <strong>{t('pricing.credit_3')}</strong> {t('pricing.explain_reveal')}
              </span>
              <span>
                <strong>{t('pricing.credit_3')}</strong> {t('pricing.explain_workout')}
              </span>
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
                const features = getPricingPackFeatures(locale, pack.key);

                return (
                  <div
                    key={pack.key}
                    className={`${styles.card} ${isBestValue ? styles.cardBestValue : ''}`}
                  >
                    {isBestValue && <span className={styles.badge}>{t('pricing.best_value_badge')}</span>}
                    <h3 className={styles.planName}>{getPricingPackTitle(locale, pack.key)}</h3>
                    <div className={styles.price}>
                      <span className={styles.currency}>$</span>
                      <span className={styles.amount}>{pack.priceUsd.toFixed(2)}</span>
                      {!isFree && <span className={styles.period}>{t('pricing.one_time')}</span>}
                    </div>
                    <p className={styles.creditsLabel}>
                      {formatI18n(t('pricing.credits_count'), { n: pack.credits })}
                    </p>
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
                      {isLoading ? t('pricing.redirecting') : ctaLabel(pack)}
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
                {t('pricing.trust_secure')}
              </span>
              <span className={styles.trustItem}>
                <svg className={styles.trustIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                {t('pricing.trust_never_expire')}
              </span>
              <span className={styles.trustItem}>
                <svg className={styles.trustIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                </svg>
                {t('pricing.trust_instant')}
              </span>
              <span className={styles.trustItem}>
                <svg className={styles.trustIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                {t('pricing.trust_one_time')}
              </span>
            </div>

            <section className={styles.featureSection}>
              <h2 className={styles.featureSectionTitle}>{t('pricing.section_what_title')}</h2>
              <div className={styles.featureTiles}>
                <div className={styles.featureTile}>
                  <div className={styles.featureTileIcon} aria-hidden>
                    💬
                  </div>
                  <h3 className={styles.featureTileTitle}>{t('pricing.tile_unlock_title')}</h3>
                  <p className={styles.featureTileDesc}>{t('pricing.tile_unlock_desc')}</p>
                  <span className={styles.featureTileBadge}>{t('pricing.cost_1')}</span>
                </div>
                <div className={styles.featureTile}>
                  <div className={styles.featureTileIcon} aria-hidden>
                    💡
                  </div>
                  <h3 className={styles.featureTileTitle}>{t('pricing.tile_icebreaker_title')}</h3>
                  <p className={styles.featureTileDesc}>{t('pricing.tile_icebreaker_desc')}</p>
                  <span className={styles.featureTileBadge}>{t('pricing.cost_1')}</span>
                </div>
                <div className={styles.featureTile}>
                  <div className={styles.featureTileIcon} aria-hidden>
                    📈
                  </div>
                  <h3 className={styles.featureTileTitle}>{t('pricing.tile_boost_title')}</h3>
                  <p className={styles.featureTileDesc}>{t('pricing.tile_boost_desc')}</p>
                  <span className={styles.featureTileBadge}>{t('pricing.cost_2')}</span>
                </div>
                <div className={styles.featureTile}>
                  <div className={styles.featureTileIcon} aria-hidden>
                    ✨
                  </div>
                  <h3 className={styles.featureTileTitle}>{t('pricing.tile_insight_title')}</h3>
                  <p className={styles.featureTileDesc}>{t('pricing.tile_insight_desc')}</p>
                  <span className={styles.featureTileBadge}>{t('pricing.cost_2')}</span>
                </div>
                <div className={styles.featureTile}>
                  <div className={styles.featureTileIcon} aria-hidden>
                    ❤️
                  </div>
                  <h3 className={styles.featureTileTitle}>{t('pricing.tile_reveal_title')}</h3>
                  <p className={styles.featureTileDesc}>{t('pricing.tile_reveal_desc')}</p>
                  <span className={styles.featureTileBadge}>{t('pricing.cost_3')}</span>
                </div>
                <div className={styles.featureTile}>
                  <div className={styles.featureTileIcon} aria-hidden>
                    📋
                  </div>
                  <h3 className={styles.featureTileTitle}>{t('pricing.tile_workout_title')}</h3>
                  <p className={styles.featureTileDesc}>{t('pricing.tile_workout_desc')}</p>
                  <span className={styles.featureTileBadge}>{t('pricing.cost_3')}</span>
                </div>
              </div>
            </section>

            <section className={styles.whyCreditsSection}>
              <h2 className={styles.whyCreditsTitle}>{t('pricing.why_title')}</h2>
              <ul className={styles.whyCreditsList}>
                <li>{t('pricing.why_1')}</li>
                <li>{t('pricing.why_2')}</li>
                <li>{t('pricing.why_3')}</li>
                <li>{t('pricing.why_4')}</li>
              </ul>
            </section>

            <div className={styles.faq}>
              <h3 className={styles.faqTitle}>{t('pricing.faq_title')}</h3>
              <details className={styles.faqItem}>
                <summary>{t('pricing.faq_q1')}</summary>
                <p>{t('pricing.faq_a1')}</p>
              </details>
              <details className={styles.faqItem}>
                <summary>{t('pricing.faq_q2')}</summary>
                <p>{t('pricing.faq_a2')}</p>
              </details>
              <details className={styles.faqItem}>
                <summary>{t('pricing.faq_q3')}</summary>
                <p>{t('pricing.faq_a3')}</p>
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
