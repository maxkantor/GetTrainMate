import React, { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback?: (token: string) => void;
          'error-callback'?: (code?: string | Error | unknown) => void;
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
// Explicit render + onload callback: async/defer is correct. Do NOT call turnstile.ready()
// with this pattern — Cloudflare throws if ready() is used with async/defer.
const SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onGetTrainMateTurnstileLoad';

export const TURNSTILE_SITE_KEY = String(import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim();

type Props = {
  onToken: (token: string | null) => void;
  onStatus?: (status: 'idle' | 'ready' | 'error', detail?: string) => void;
  disabled?: boolean;
};

function errorDetail(code: unknown): string {
  const c = String(code ?? '');
  if (c.includes('110200')) {
    return 'Security check blocked: add gettrainmate.com to this Turnstile widget’s hostnames in Cloudflare.';
  }
  if (c) return `Security check failed (${c}). Refresh and try again.`;
  return 'Security check failed to load. Refresh and try again.';
}

/**
 * Cloudflare Turnstile widget. Renders only when VITE_TURNSTILE_SITE_KEY is set.
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
      if (widgetIdRef.current) return; // already mounted for this effect cycle

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
          'error-callback': (code) => fail(errorDetail(code)),
          'expired-callback': () => {
            onTokenRef.current(null);
            onStatusRef.current?.('idle');
          },
        });
      } catch (e) {
        fail(e instanceof Error ? e.message : 'Security check failed to start.');
      }
    };

    // Register before inserting script so onload never misses.
    const prevOnload = window.onGetTrainMateTurnstileLoad;
    window.onGetTrainMateTurnstileLoad = () => {
      try {
        prevOnload?.();
      } catch {
        /* ignore */
      }
      mount();
    };

    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onerror = () => fail('Could not load Cloudflare security script.');
      document.head.appendChild(script);
    } else if (window.turnstile) {
      mount();
    }

    // If script finished before our onload assignment, poll briefly.
    const poll = window.setInterval(() => {
      if (cancelled || widgetIdRef.current) {
        window.clearInterval(poll);
        return;
      }
      if (window.turnstile) {
        window.clearInterval(poll);
        mount();
      }
    }, 200);
    const stop = window.setTimeout(() => {
      window.clearInterval(poll);
      if (!cancelled && !widgetIdRef.current) {
        fail('Security check timed out loading. Refresh and try again.');
      }
    }, 10000);

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
