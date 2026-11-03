import React, { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback?: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
          action?: string;
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
    onGetTrainMateTurnstileLoad?: () => void;
  }
}

const SCRIPT_ID = 'cf-turnstile-api';
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onGetTrainMateTurnstileLoad';

export const TURNSTILE_SITE_KEY = String(import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim();

type Props = {
  onToken: (token: string | null) => void;
  disabled?: boolean;
};

/**
 * Cloudflare Turnstile widget. Renders only when VITE_TURNSTILE_SITE_KEY is set.
 * Site keys are public; the secret stays server-side.
 */
export const TurnstileWidget: React.FC<Props> = ({ onToken, disabled }) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || disabled) return;

    let cancelled = false;

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
      widgetIdRef.current = window.turnstile.render(hostRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'dark',
        action: 'contact',
        callback: (token) => onTokenRef.current(token),
        'error-callback': () => onTokenRef.current(null),
        'expired-callback': () => onTokenRef.current(null),
      });
    };

    window.onGetTrainMateTurnstileLoad = () => {
      if (!cancelled) mount();
    };

    if (!document.getElementById(SCRIPT_ID)) {
      const s = document.createElement('script');
      s.id = SCRIPT_ID;
      s.src = SCRIPT_SRC;
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    } else if (window.turnstile) {
      mount();
    }

    return () => {
      cancelled = true;
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
    <BoxLike>
      <div ref={hostRef} />
    </BoxLike>
  );
};

/** Tiny spacing wrapper without pulling MUI into this module's import cycle concerns. */
const BoxLike: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ marginBottom: 16, minHeight: 65 }}>{children}</div>
);

export function resetTurnstile(): void {
  try {
    window.turnstile?.reset();
  } catch {
    /* ignore */
  }
}
