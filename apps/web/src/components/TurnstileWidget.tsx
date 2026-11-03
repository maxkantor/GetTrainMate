import React, { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback?: (token: string) => void;
          'error-callback'?: (code?: string) => void;
          'expired-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
          action?: string;
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
      ready?: (cb: () => void) => void;
    };
    onGetTrainMateTurnstileLoad?: () => void;
  }
}

const SCRIPT_ID = 'cf-turnstile-api';
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onGetTrainMateTurnstileLoad';

export const TURNSTILE_SITE_KEY = String(import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim();

type Props = {
  onToken: (token: string | null) => void;
  onStatus?: (status: 'idle' | 'ready' | 'error', detail?: string) => void;
  disabled?: boolean;
};

/**
 * Cloudflare Turnstile widget. Renders only when VITE_TURNSTILE_SITE_KEY is set.
 * Site keys are public; the secret stays server-side.
 */
export const TurnstileWidget: React.FC<Props> = ({ onToken, onStatus, disabled }) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const onStatusRef = useRef(onStatus);
  onTokenRef.current = onToken;
  onStatusRef.current = onStatus;
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || disabled) return;

    let cancelled = false;

    const fail = (detail: string) => {
      if (cancelled) return;
      setErrorText(detail);
      onTokenRef.current(null);
      onStatusRef.current?.('error', detail);
    };

    const mount = () => {
      if (cancelled || !hostRef.current || !window.turnstile) return;
      if (widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* ignore */
        }
        widgetIdRef.current = null;
      }
      hostRef.current.innerHTML = '';
      setErrorText(null);
      onStatusRef.current?.('idle');
      try {
        widgetIdRef.current = window.turnstile.render(hostRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: 'dark',
          action: 'contact',
          callback: (token) => {
            if (cancelled) return;
            setErrorText(null);
            onTokenRef.current(token);
            onStatusRef.current?.('ready');
          },
          'error-callback': (code) => {
            const c = String(code || '');
            const detail =
              c.startsWith('110200')
                ? 'Security check blocked: add gettrainmate.com to this Turnstile widget’s hostnames in Cloudflare.'
                : c
                  ? `Security check failed (${c}). Refresh and try again.`
                  : 'Security check failed to load. Refresh and try again.';
            fail(detail);
          },
          'expired-callback': () => {
            onTokenRef.current(null);
            onStatusRef.current?.('idle');
          },
        });
      } catch (e) {
        fail(e instanceof Error ? e.message : 'Security check failed to start.');
      }
    };

    const tryMount = () => {
      if (cancelled) return;
      if (window.turnstile) {
        // turnstile.ready is available on newer api.js builds
        if (typeof window.turnstile.ready === 'function') {
          window.turnstile.ready(() => mount());
        } else {
          mount();
        }
      }
    };

    window.onGetTrainMateTurnstileLoad = () => tryMount();

    if (!document.getElementById(SCRIPT_ID)) {
      const s = document.createElement('script');
      s.id = SCRIPT_ID;
      s.src = SCRIPT_SRC;
      s.async = true;
      s.defer = true;
      s.onerror = () => fail('Could not load Cloudflare security script.');
      document.head.appendChild(s);
    } else {
      tryMount();
    }

    // If onload already fired before our handler was assigned, retry briefly.
    const poll = window.setInterval(() => {
      if (cancelled || widgetIdRef.current) {
        window.clearInterval(poll);
        return;
      }
      if (window.turnstile) {
        window.clearInterval(poll);
        tryMount();
      }
    }, 250);
    const stop = window.setTimeout(() => window.clearInterval(poll), 8000);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      window.clearTimeout(stop);
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* ignore */
        }
        widgetIdRef.current = null;
      }
    };
  }, [disabled]);

  if (!TURNSTILE_SITE_KEY) return null;

  return (
    <div style={{ marginBottom: 16, minHeight: 65 }}>
      <div ref={hostRef} />
      {errorText ? (
        <p style={{ color: '#f87171', fontSize: 13, margin: '8px 0 0' }} role="alert">
          {errorText}
        </p>
      ) : null}
    </div>
  );
};

export function resetTurnstile(): void {
  try {
    window.turnstile?.reset();
  } catch {
    /* ignore */
  }
}
