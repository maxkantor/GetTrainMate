import { useCallback, useContext } from 'react';
import { I18nContext } from '@/contexts/I18nContext';
import { t } from '@/i18n';

export const useI18n = () => {
  const { locale, setLocale } = useContext(I18nContext);

  const translate = useCallback((path: string) => t(locale, path), [locale]);

  return {
    locale,
    setLocale,
    t: translate,
  };
};
