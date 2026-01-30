import React, { useState, useRef, useEffect } from 'react';
import { useI18n } from '@/hooks/useI18n';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, type Locale } from '@/i18n';
import styles from './LanguageDropdown.module.css';

const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  ru: 'Русский',
  ua: 'Українська',
  hi: 'हिन्दी',
  zh: '中文',
};

export const LanguageDropdown: React.FC = () => {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const currentLocale = SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        listRef.current && !listRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowDown' && index < SUPPORTED_LOCALES.length - 1) {
      e.preventDefault();
      (listRef.current?.children[index + 1] as HTMLElement)?.focus();
    }
    if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault();
      (listRef.current?.children[index - 1] as HTMLElement)?.focus();
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setLocale(SUPPORTED_LOCALES[index]);
      setOpen(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.trigger}
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('common.language')}
        title={t('common.language')}
      >
        <span className={styles.globe} aria-hidden>🌐</span>
        <span className={styles.code}>{currentLocale.toUpperCase()}</span>
        <svg className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul
          ref={listRef}
          className={styles.menu}
          role="listbox"
          aria-label={t('common.language')}
          aria-activedescendant={`locale-${currentLocale}`}
        >
          {SUPPORTED_LOCALES.map((loc, index) => (
            <li key={loc}>
              <button
                type="button"
                id={`locale-${loc}`}
                role="option"
                aria-selected={loc === currentLocale}
                className={`${styles.option} ${loc === currentLocale ? styles.optionActive : ''}`}
                onClick={() => {
                  setLocale(loc);
                  setOpen(false);
                }}
                onKeyDown={(e) => handleKeyDown(e, index)}
              >
                <span className={styles.optionCode}>{loc.toUpperCase()}</span>
                <span className={styles.optionLabel}>{LOCALE_LABELS[loc]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
