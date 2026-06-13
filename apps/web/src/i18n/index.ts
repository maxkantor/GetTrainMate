import type { CreditPackKey } from '@/data/creditPacks';
import { CREDIT_PACK_FEATURES } from '@/data/creditPacks';
import { en } from './locales/en';
import { es } from './locales/es';
import { ru } from './locales/ru';
import { ua } from './locales/ua';
import { hi } from './locales/hi';
import { zh } from './locales/zh';
import { fr } from './locales/fr';
import { de } from './locales/de';

export type Locale = 'en' | 'es' | 'ru' | 'ua' | 'hi' | 'zh' | 'fr' | 'de';

export const SUPPORTED_LOCALES: Locale[] = ['en', 'es', 'ru', 'ua', 'hi', 'zh', 'fr', 'de'];
export const DEFAULT_LOCALE: Locale = 'en';

const translations = {
  en,
  es,
  ru,
  ua,
  hi,
  zh,
  fr,
  de,
};

export type TranslationKeys = typeof en;

export const getTranslation = (locale: Locale) => {
  return translations[locale] || translations[DEFAULT_LOCALE];
};

export const t = (locale: Locale, path: string): string => {
  const keys = path.split('.');
  let value: unknown = getTranslation(locale);
  let found = true;

  for (const key of keys) {
    if (value != null && typeof value === 'object' && key in (value as Record<string, unknown>)) {
      value = (value as Record<string, unknown>)[key];
    } else {
      found = false;
      break;
    }
  }

  if (found && typeof value === 'string') return value;

  let fallback: unknown = getTranslation(DEFAULT_LOCALE);
  for (const key of keys) {
    if (fallback != null && typeof fallback === 'object' && key in (fallback as Record<string, unknown>)) {
      fallback = (fallback as Record<string, unknown>)[key];
    } else {
      return path;
    }
  }

  return typeof fallback === 'string' ? fallback : path;
};

/** Replace `{name}` placeholders in translated strings (e.g. `{price}`, `{credits}`). */
export function formatI18n(template: string, vars: Record<string, string | number>): string {
  let s = template;
  for (const [k, v] of Object.entries(vars)) {
    s = s.split(`{${k}}`).join(String(v));
  }
  return s;
}

/** Localized credit pack display name (pricing cards). */
export function getPricingPackTitle(locale: Locale, key: CreditPackKey): string {
  const tr = getTranslation(locale) as unknown as { pricing?: { packTitles?: Partial<Record<CreditPackKey, string>> } };
  const enTr = getTranslation(DEFAULT_LOCALE) as unknown as {
    pricing: { packTitles: Partial<Record<CreditPackKey, string>> };
  };
  return tr.pricing?.packTitles?.[key] ?? enTr.pricing.packTitles[key] ?? key;
}

/** Bullet list under each pricing tier — falls back to English static data if locale incomplete. */
export function getPricingPackFeatures(locale: Locale, key: CreditPackKey): string[] {
  const tr = getTranslation(locale) as unknown as {
    pricing?: { packFeatures?: Partial<Record<CreditPackKey, readonly string[]>> };
  };
  const loc = tr.pricing?.packFeatures?.[key];
  if (Array.isArray(loc) && loc.length > 0) return [...loc];
  const enTr = getTranslation(DEFAULT_LOCALE) as unknown as {
    pricing: { packFeatures: Partial<Record<CreditPackKey, readonly string[]>> };
  };
  const enLoc = enTr.pricing.packFeatures[key];
  if (Array.isArray(enLoc) && enLoc.length > 0) return [...enLoc];
  return [...(CREDIT_PACK_FEATURES[key] ?? [])];
}
