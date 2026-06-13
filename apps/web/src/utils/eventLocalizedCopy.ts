import type { Locale } from '@/i18n';
import type { SportsEventConfig } from '@/services/sportsEventLayerService';

export type EventLocalizedCopy = {
  label?: string;
  description?: string;
  landingHeadline?: string;
  homepageHeadline?: string;
  homepageSubheadline?: string;
  homepageCtaPrimary?: string;
  homepageCtaSecondary?: string;
  homepagePromoText?: string;
  ctaLabel?: string;
};

export type EventLocalizedCopyMap = Partial<Record<Locale, EventLocalizedCopy>>;

const COPY_FIELDS: (keyof EventLocalizedCopy)[] = [
  'label',
  'description',
  'landingHeadline',
  'homepageHeadline',
  'homepageSubheadline',
  'homepageCtaPrimary',
  'homepageCtaSecondary',
  'homepagePromoText',
  'ctaLabel',
];

const CONFIG_FIELD_MAP: Record<keyof EventLocalizedCopy, keyof SportsEventConfig> = {
  label: 'label',
  description: 'description',
  landingHeadline: 'landingHeadline',
  homepageHeadline: 'homepageHeadline',
  homepageSubheadline: 'homepageSubheadline',
  homepageCtaPrimary: 'homepageCtaPrimary',
  homepageCtaSecondary: 'homepageCtaSecondary',
  homepagePromoText: 'homepagePromoText',
  ctaLabel: 'ctaLabel',
};

export function resolveEventCopy<K extends keyof EventLocalizedCopy>(
  config: SportsEventConfig | undefined,
  locale: Locale,
  field: K
): string | undefined {
  if (!config) return undefined;
  const localized = config.localizedCopy?.[locale]?.[field];
  if (localized?.trim()) return localized.trim();
  const enLocalized = config.localizedCopy?.en?.[field];
  if (locale !== 'en' && enLocalized?.trim()) return enLocalized.trim();
  const configKey = CONFIG_FIELD_MAP[field];
  const base = config[configKey];
  return typeof base === 'string' && base.trim() ? base.trim() : undefined;
}

export function hasLocalizedCopy(config: SportsEventConfig | undefined): boolean {
  if (!config?.localizedCopy) return false;
  return Object.values(config.localizedCopy).some((entry) =>
    entry && COPY_FIELDS.some((f) => entry[f]?.trim())
  );
}
