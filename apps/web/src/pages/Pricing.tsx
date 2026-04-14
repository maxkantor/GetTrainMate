import React, { useState, useEffect, useCallback } from 'react';
import { analytics, trackBeginCheckout } from '@/utils/analytics';
import { useSearchParams } from 'react-router-dom';
import { Container } from '@/components/layout/Container';
import { PageShell } from '@/components/layout/PageShell';
import { authService } from '@/services/authService';
import { billingService, CreditPackDto } from '@/services/billingService';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useMe } from '@/hooks/useMe';
import { useI18n } from '@/hooks/useI18n';
import { formatI18n, getPricingPackFeatures, getPricingPackTitle } from '@/i18n';
import { CreditPack, FALLBACK_CREDIT_PACKS, CreditPackKey } from '@/data/creditPacks';
import { CANONICAL_PACK_KEYS, normalizeCreditPackKey } from '@/config/pricingPlans';
import { useCreditsUsageModal } from '@/contexts/CreditsUsageModalContext';
import styles from '@/pages/Pricing.module.css';

const MAX_BULLETS = 5;

function mapApiToCreditPack(dto: CreditPackDto): CreditPack | null {
  const key = normalizeCreditPackKey(dto.key);
  if (!key) return null;
  const fallback = FALLBACK_CREDIT_PACKS.find((p) => p.key === key);
  return {
    key,
    title: dto.title || fallback?.title || key,
    priceUsd: dto.priceUsd ?? fallback?.priceUsd ?? 0,
    credits: dto.credits ?? fallback?.credits ?? 0,
    sortOrder: dto.sortOrder ?? fallback?.sortOrder ?? 0,
    isBestValue: dto.isBestValue ?? fallback?.isBestValue ?? false,
    isFree: key === 'starter',
  };
}

function toCreditPacks(dtos: CreditPackDto[]): CreditPack[] {
  if (!dtos?.length) return FALLBACK_CREDIT_PACKS;
  const mapped = dtos
    .filter((d) => d.isActive !== false)
    .map(mapApiToCreditPack)
    .filter((p): p is CreditPack => p != null);
  const byKey = new Map<CreditPackKey, CreditPack>();
  for (const p of mapped) {
    const existing = byKey.get(p.key);
    if (!existing || p.sortOrder < existing.sortOrder) byKey.set(p.key, p);
  }
  const list = [...byKey.values()].sort((a, b) => a.sortOrder - b.sortOrder);
  if (!list.length) return FALLBACK_CREDIT_PACKS;
  const keys = new Set(list.map((p) => p.key));
  const missing = CANONICAL_PACK_KEYS.filter((k) => !keys.has(k));
  if (missing.length === 0) return list;
  const extras = FALLBACK_CREDIT_PACKS.filter((p) => missing.includes(p.key));
  return [...list, ...extras].sort((a, b) => a.sortOrder - b.sortOrder);
}

function pricePerCreditLine(t: (k: string) => string, priceUsd: number, credits: number): string | null {
  if (credits <= 0 || priceUsd <= 0) return null;
  const per = (priceUsd / credits).toFixed(2);
  return formatI18n(t('pricing.price_per_credit'), { price: per });
}

export const PricingPage: React.FC = () => {
  const { t, locale } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, user } = useAuthContext();
  const { me } = useMe();
  const { openModal: openCreditsUsageModal } = useCreditsUsageModal();
  const [packs, setPacks] = useState<CreditPack[]>(FALLBACK_CREDIT_PACKS);
  const [error, setError] = useState<string | null>(null);
  const [loadingPack, setLoadingPack] = useState<string | null>(null);

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

  const startCheckout = useCallback(
    async (pack: CreditPack) => {
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
    },
    [locale, t]
  );

  const handlePaidCta = useCallback(
    (pack: CreditPack) => {
      if (!isAuthenticated || !user) {
        window.location.href = '/signup';
        return;
      }
      startCheckout(pack);
    },
    [isAuthenticated, user, startCheckout]
  );

  const sortedPacks = [...packs].sort((a, b) => a.sortOrder - b.sortOrder);

  const credits = me?.credits ?? 0;

  return (
    <>
      <PageShell variant="pricing" showBackLink>
        <section className={styles.hero}>
          <Container>
            {isAuthenticated && (
              <p className={styles.creditBalanceLabel} data-testid="pricing-your-credits">
                {formatI18n(t('pricing.you_have_credits'), { n: credits })}
              </p>
            )}
            <h1 className={styles.title}>{t('pricing.hero_title')}</h1>
            <p className={styles.subtext}>{t('pricing.hero_sub')}</p>
            <button
              type="button"
              className={styles.creditsUsageLink}
              onClick={() => openCreditsUsageModal('pricing')}
            >
              {t('credits_usage.pricing_link')}
            </button>
            <p className={styles.heroTrustRow}>{t('pricing.hero_trust_row')}</p>
            <p className={styles.heroFeaturePills}>{t('pricing.hero_feature_pills')}</p>
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
                const isPaid = !isFree;
                const isLoading = loadingPack === pack.key;
                const features = getPricingPackFeatures(locale, pack.key).slice(0, MAX_BULLETS);
                const perCredit = pricePerCreditLine(t, pack.priceUsd, pack.credits);

                return (
                  <div
                    key={pack.key}
                    className={`${styles.cardColumn} ${isBestValue ? styles.cardColumnFeatured : ''}`}
                  >
                    <div className={styles.badgeAboveSlot} aria-hidden={!isBestValue}>
                      {isBestValue ? (
                        <span className={styles.badgeAbove}>{t('pricing.best_value_badge')}</span>
                      ) : null}
                    </div>
                    <div
                      className={[
                        styles.card,
                        isBestValue ? styles.cardBestValue : '',
                        isFree ? styles.cardStarter : '',
                        isPaid && !isBestValue ? styles.cardDimmed : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <h3 className={styles.planName}>{getPricingPackTitle(locale, pack.key)}</h3>
                      <div className={styles.priceBlock}>
                        <div className={styles.priceRow}>
                          <span className={styles.currency}>$</span>
                          <span className={styles.amount}>{pack.priceUsd.toFixed(2)}</span>
                        </div>
                        <p className={styles.creditsLabel}>
                          {formatI18n(t('pricing.credits_count'), { n: pack.credits })}
                        </p>
                        {isBestValue && (
                          <p className={styles.mostPopular}>{t('pricing.best_value_popular')}</p>
                        )}
                        {perCredit && <p className={styles.pricePerCredit}>{perCredit}</p>}
                      </div>
                      <hr className={styles.cardDivider} />
                      <ul className={styles.features}>
                        {features.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                      <div className={styles.cardCtaSlot}>
                        {isFree ? (
                          <p className={styles.starterIncluded}>{t('pricing.starter_included')}</p>
                        ) : (
                          <button
                            type="button"
                            className={isBestValue ? styles.btnBestValue : styles.btnPaid}
                            onClick={() => handlePaidCta(pack)}
                            disabled={!!loadingPack}
                          >
                            {isLoading ? t('pricing.redirecting') : t('pricing.cta_get_credits')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
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
    </>
  );
};
