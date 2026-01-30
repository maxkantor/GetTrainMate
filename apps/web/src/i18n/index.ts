import { en } from './locales/en';
import { es } from './locales/es';
import { ru } from './locales/ru';
import { ua } from './locales/ua';
import { hi } from './locales/hi';
import { zh } from './locales/zh';

export type Locale = 'en' | 'es' | 'ru' | 'ua' | 'hi' | 'zh';

export const SUPPORTED_LOCALES: Locale[] = ['en', 'es', 'ru', 'ua', 'hi', 'zh'];
export const DEFAULT_LOCALE: Locale = 'en';

const translations = {
  en,
  es,
  ru,
  ua,
  hi,
  zh,
};

export type TranslationKeys = typeof en;

export const getTranslation = (locale: Locale) => {
  return translations[locale] || translations[DEFAULT_LOCALE];
};

export const t = (locale: Locale, path: string): string => {
  const keys = path.split('.');
  let value: any = getTranslation(locale);

  for (const key of keys) {
    value = value?.[key];
    if (value === undefined) {
      // Fallback to English
      value = getTranslation(DEFAULT_LOCALE);
      for (const k of keys) {
        value = value?.[k];
      }
      break;
    }
  }

  return typeof value === 'string' ? value : path;
};
