import { useContext } from 'react';
import { I18nContext } from '@/contexts/I18nContext';
import { t } from '@/i18n';

export const useI18n = () => {
  const { locale, setLocale } = useContext(I18nContext);
  
  return {
    locale,
    setLocale,
    t: (path: string) => t(locale, path),
  };
};
