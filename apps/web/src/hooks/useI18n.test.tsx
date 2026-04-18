import React, { useState } from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider } from '@/contexts/I18nContext';
import { useI18n } from './useI18n';

/** Filled during render — one entry per render. */
const tPerRender: Array<(path: string) => string> = [];

function ReRenderProbe() {
  const { t } = useI18n();
  const [, setBump] = useState(0);
  tPerRender.push(t);
  return (
    <button type="button" aria-label="re-render" onClick={() => setBump((n) => n + 1)} />
  );
}

describe('useI18n', () => {
  beforeEach(() => {
    tPerRender.length = 0;
    localStorage.clear();
  });

  it('returns a stable t reference across re-renders when locale is unchanged', () => {
    render(
      <I18nProvider>
        <ReRenderProbe />
      </I18nProvider>
    );

    expect(tPerRender.length).toBeGreaterThanOrEqual(1);
    const t0 = tPerRender[0];

    fireEvent.click(screen.getByRole('button', { name: 're-render' }));
    fireEvent.click(screen.getByRole('button', { name: 're-render' }));

    expect(tPerRender.length).toBeGreaterThanOrEqual(3);
    expect(tPerRender[1]).toBe(t0);
    expect(tPerRender[2]).toBe(t0);
  });

  it('returns a new t reference after the locale changes', () => {
    const snapshots: { t: (path: string) => string; locale: string }[] = [];

    function LocaleProbe() {
      const { t, locale, setLocale } = useI18n();
      snapshots.push({ t, locale });
      return (
        <div>
          <span data-testid="locale">{locale}</span>
          <button type="button" aria-label="switch-es" onClick={() => setLocale('es')} />
        </div>
      );
    }

    render(
      <I18nProvider>
        <LocaleProbe />
      </I18nProvider>
    );

    const initial = snapshots[0];
    const tBefore = initial.t;

    fireEvent.click(screen.getByRole('button', { name: 'switch-es' }));

    expect(screen.getByTestId('locale').textContent).toBe('es');
    const after = snapshots[snapshots.length - 1];
    expect(after.locale).toBe('es');
    expect(after.t).not.toBe(tBefore);
  });
});
