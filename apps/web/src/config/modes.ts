export type AppMode = 'TRAIN' | 'VIBE' | 'DATE';

const VALID: AppMode[] = ['TRAIN', 'VIBE', 'DATE'];

export type TFunc = (key: string) => string;

export function normalizeMode(m: string | undefined | null): AppMode {
  const u = String(m || 'TRAIN').toUpperCase();
  return VALID.includes(u as AppMode) ? (u as AppMode) : 'TRAIN';
}

export function normalizeModes(list: string[] | undefined | null): AppMode[] {
  if (!list?.length) return ['TRAIN'];
  const next = [...new Set(list.map((m) => normalizeMode(m)))];
  return next.length ? next : ['TRAIN'];
}

const MODE_ICON: Record<AppMode, string> = {
  TRAIN: '🏋️',
  VIBE: '🧑‍🤝‍🧑',
  DATE: '❤️',
};

function modeLabelKey(mode: AppMode): string {
  return mode === 'TRAIN' ? 'modes.train' : mode === 'VIBE' ? 'modes.vibe' : 'modes.date';
}

function modeCtaKey(mode: AppMode): string {
  return mode === 'TRAIN'
    ? 'modes.cta_train_together'
    : mode === 'VIBE'
      ? 'modes.cta_hang_out'
      : 'modes.cta_go_on_date';
}

export function modeIcon(mode: AppMode): string {
  return MODE_ICON[mode];
}

/**
 * Primary Discover CTA from **shared intent** only. Priority when multiple overlap: DATE → TRAIN → VIBE.
 * When there is no mode overlap, use neutral "Connect" (never imply Train/Date/Vibe without shared intent).
 */
export function getDiscoverPrimaryCta(
  t: TFunc,
  viewerModes: string[] | undefined,
  cardModes?: string[] | undefined
): { label: string; icon: string } {
  const v = normalizeModes(viewerModes);
  const c = normalizeModes(cardModes);
  const intersection = v.filter((m) => c.includes(m));
  if (intersection.length > 0) {
    const priority: AppMode[] = ['DATE', 'TRAIN', 'VIBE'];
    for (const p of priority) {
      if (intersection.includes(p)) return { label: t(modeCtaKey(p)), icon: modeIcon(p) };
    }
    const m = intersection[0]!;
    return { label: t(modeCtaKey(m)), icon: modeIcon(m) };
  }
  return { label: t('modes.cta_connect'), icon: '✨' };
}

/**
 * Which shared mode drives the CTA (for analytics / tests). If no overlap, returns viewer's primary mode only for legacy callers — prefer {@link getDiscoverPrimaryCta} for UI.
 */
export function getCtaModeForCard(viewerModes: string[] | undefined, cardModes?: string[] | undefined): AppMode {
  const v = normalizeModes(viewerModes);
  const c = normalizeModes(cardModes);
  const intersection = v.filter((m) => c.includes(m));
  if (intersection.length > 0) {
    const priority: AppMode[] = ['DATE', 'TRAIN', 'VIBE'];
    for (const p of priority) {
      if (intersection.includes(p)) return p;
    }
    return intersection[0]!;
  }
  return normalizeMode(v[0] ?? c[0]);
}

/** Label only; uses neutral "Connect" when intents do not overlap. */
export function getPrimaryCtaLabel(t: TFunc, viewerModes: string[] | undefined, cardModes?: string[]): string {
  return getDiscoverPrimaryCta(t, viewerModes, cardModes).label;
}

export function formatLookingForLine(t: TFunc, modes: string[] | undefined): string {
  const m = normalizeModes(modes);
  const parts = m.map((x) => `${modeIcon(x)} ${t(modeLabelKey(x))}`);
  return `${t('modes.looking_for')}: ${parts.join(' · ')}`;
}
