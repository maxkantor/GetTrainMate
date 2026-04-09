import { API_BASE_URL } from '@/config/api';

const CACHE_KEY = 'gtmLandingShowcaseV4';
const TTL_MS = 10 * 60 * 1000;

export type LandingShowcaseActivity = {
  line: string;
  avatarUrl?: string | null;
  /** Second avatar for “A matched with B” when both photos exist. */
  secondaryAvatarUrl?: string | null;
};

export type LandingShowcaseDeckCard = {
  name: string;
  age?: number | null;
  photoUrl?: string | null;
  tags: string[];
  matchPct: number;
};

export type LandingShowcaseResult = {
  kind: string;
  /** Premium match preview price in USD (hero + swipe demo). */
  premiumMatchPreviewUsd?: number;
  activity: LandingShowcaseActivity[];
  deck: LandingShowcaseDeckCard[];
};

/**
 * Hero + swipe demo: real profile photos from the API (complete profiles with photos in Dynamo).
 * Cached briefly to avoid extra traffic on navigation.
 */
export async function fetchLandingShowcase(): Promise<LandingShowcaseResult | null> {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { at?: number; data?: LandingShowcaseResult };
      if (typeof parsed.at === 'number' && Date.now() - parsed.at < TTL_MS && parsed.data) return parsed.data;
    }
  } catch {
    /* ignore */
  }

  const res = await fetch(`${API_BASE_URL}/api/public/landing-showcase`);
  if (!res.ok) return null;
  const data = (await res.json()) as LandingShowcaseResult;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* ignore */
  }
  return data;
}
