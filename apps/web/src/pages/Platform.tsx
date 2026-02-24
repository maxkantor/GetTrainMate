import React, { useState, useCallback, useRef } from 'react';
import { BackLink } from '@/components/ui/BackLink';
import styles from './Platform.module.css';

const PLATFORM_URL = 'https://mk-ai-global-page.s3.us-east-1.amazonaws.com/platform/index.html';
const LOAD_TIMEOUT_MS = 8000;

export const PlatformPage: React.FC = () => {
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLoad = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setLoaded(true);
    setTimedOut(false);
  }, []);

  const handleTimeout = useCallback(() => {
    timeoutRef.current = null;
    if (!loaded) {
      setTimedOut(true);
    }
  }, [loaded]);

  React.useEffect(() => {
    if (loaded || timedOut) return;
    timeoutRef.current = setTimeout(handleTimeout, LOAD_TIMEOUT_MS);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [loaded, timedOut, handleTimeout]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.backRow}>
            <BackLink label="Back" />
          </div>
          <h1 className={styles.title}>Platform</h1>
          <p className={styles.subtitle}>MK AI & Performance Systems</p>
        </div>
      </header>

      <div className={styles.iframeContainer}>
        {timedOut ? (
          <div className={styles.fallback}>
            <p className={styles.fallbackMessage}>
              Unable to load platform page. Open in a new tab.
            </p>
            <a
              href={PLATFORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.fallbackLink}
            >
              Open platform page
            </a>
          </div>
        ) : (
          <>
            {!loaded && !timedOut && (
              <div className={styles.loading} aria-live="polite">
                Loading…
              </div>
            )}
            <iframe
              src={PLATFORM_URL}
              title="MK AI & Performance Systems"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
              allow="clipboard-read; clipboard-write"
              className={`${styles.iframe} ${loaded ? styles.iframeVisible : ''}`}
              onLoad={handleLoad}
            />
          </>
        )}
      </div>
    </div>
  );
};
