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

/** Primary CTA from viewer's intent (first selected mode) or card's primary mode. */
export function getPrimaryCtaLabel(viewerModes: string[] | undefined, cardModes?: string[]): string {
  const primary = normalizeMode(viewerModes?.[0] ?? cardModes?.[0]);
  return MODE_META[primary].cta;
}

export function formatLookingForLine(modes: string[] | undefined): string {
  const m = normalizeModes(modes);
  const parts = m.map((x) => `${MODE_META[x].icon} ${MODE_META[x].lookingLabel}`);
  return `Looking for: ${parts.join(' · ')}`;
}
