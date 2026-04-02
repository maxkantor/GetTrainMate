export type AppMode = 'TRAIN' | 'VIBE' | 'DATE';

const VALID: AppMode[] = ['TRAIN', 'VIBE', 'DATE'];

export function normalizeMode(m: string | undefined | null): AppMode {
  const u = String(m || 'TRAIN').toUpperCase();
  return VALID.includes(u as AppMode) ? (u as AppMode) : 'TRAIN';
}

export function normalizeModes(list: string[] | undefined | null): AppMode[] {
  if (!list?.length) return ['TRAIN'];
  const next = [...new Set(list.map((m) => normalizeMode(m)))];
  return next.length ? next : ['TRAIN'];
}

export const MODE_META: Record<
  AppMode,
  { icon: string; lookingLabel: string; cta: string; ctaShort: string }
> = {
  TRAIN: {
    icon: '🏋️',
    lookingLabel: 'Train',
    cta: 'Train Together',
    ctaShort: 'Train',
  },
  VIBE: {
    icon: '🧑‍🤝‍🧑',
    lookingLabel: 'Vibe',
    cta: 'Hang Out',
    ctaShort: 'Hang out',
  },
  DATE: {
    icon: '❤️',
    lookingLabel: 'Date',
    cta: 'Go on a Date',
    ctaShort: 'Date',
  },
};

/**
 * Primary Discover CTA from **shared intent** only. Priority when multiple overlap: DATE → TRAIN → VIBE.
 * When there is no mode overlap, use neutral "Connect" (never imply Train/Date/Vibe without shared intent).
 */
export function getDiscoverPrimaryCta(
  viewerModes: string[] | undefined,
  cardModes?: string[] | undefined
): { label: string; icon: string } {
  const v = normalizeModes(viewerModes);
  const c = normalizeModes(cardModes);
  const intersection = v.filter((m) => c.includes(m));
  if (intersection.length > 0) {
    const priority: AppMode[] = ['DATE', 'TRAIN', 'VIBE'];
    for (const p of priority) {
      if (intersection.includes(p)) return { label: MODE_META[p].cta, icon: MODE_META[p].icon };
    }
    const m = intersection[0]!;
    return { label: MODE_META[m].cta, icon: MODE_META[m].icon };
  }
  return { label: 'Connect', icon: '✨' };
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
export function getPrimaryCtaLabel(viewerModes: string[] | undefined, cardModes?: string[]): string {
  return getDiscoverPrimaryCta(viewerModes, cardModes).label;
}

export function formatLookingForLine(modes: string[] | undefined): string {
  const m = normalizeModes(modes);
  const parts = m.map((x) => `${MODE_META[x].icon} ${MODE_META[x].lookingLabel}`);
  return `Looking for: ${parts.join(' · ')}`;
}
