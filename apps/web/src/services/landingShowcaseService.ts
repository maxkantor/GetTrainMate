import { API_BASE_URL } from '@/config/api';

const CACHE_KEY = 'gtmLandingShowcaseV8';
const TTL_MS = 10 * 60 * 1000;

/** Lambda / some hosts may emit PascalCase; admin pages already use `x ?? X` — same here. */
function str(
  row: Record<string, unknown>,
  camel: string,
  pascal: string
): string | undefined {
  const v = row[camel] ?? row[pascal];
  if (v == null) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

function normalizeLandingShowcasePayload(raw: unknown): LandingShowcaseResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  const kind = String(d.kind ?? d.Kind ?? 'empty').trim().toLowerCase();

  const premiumRaw = d.premiumMatchPreviewUsd ?? d.PremiumMatchPreviewUsd;
  let premiumMatchPreviewUsd: number | undefined;
  if (typeof premiumRaw === 'number' && !Number.isNaN(premiumRaw)) premiumMatchPreviewUsd = premiumRaw;
  else if (typeof premiumRaw === 'string' && premiumRaw.trim()) {
    const n = Number(premiumRaw);
    if (!Number.isNaN(n)) premiumMatchPreviewUsd = n;
  }

  const actRaw = d.activity ?? d.Activity;
  const activity: LandingShowcaseActivity[] = [];
  if (Array.isArray(actRaw)) {
    for (const item of actRaw) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const line = str(row, 'line', 'Line') ?? '';
      activity.push({
        line,
        avatarUrl: str(row, 'avatarUrl', 'AvatarUrl'),
        secondaryAvatarUrl: str(row, 'secondaryAvatarUrl', 'SecondaryAvatarUrl'),
      });
    }
  }

  const deckRaw = d.deck ?? d.Deck;
  const deck: LandingShowcaseDeckCard[] = [];
  if (Array.isArray(deckRaw)) {
    for (const item of deckRaw) {
      if (!item || typeof item !== 'object') continue;
      const card = item as Record<string, unknown>;
      const tagsRaw = card.tags ?? card.Tags;
      const tags = Array.isArray(tagsRaw)
        ? tagsRaw.map((t) => String(t).trim()).filter(Boolean)
        : [];
      const ageVal = card.age ?? card.Age;
      let age: number | null | undefined;
      if (typeof ageVal === 'number' && !Number.isNaN(ageVal)) age = ageVal;
      else if (typeof ageVal === 'string' && ageVal.trim()) {
        const n = parseInt(ageVal, 10);
        if (!Number.isNaN(n)) age = n;
      }
      const mp = card.matchPct ?? card.MatchPct;
      const matchPct = typeof mp === 'number' && !Number.isNaN(mp) ? mp : Number(mp) || 0;
      deck.push({
        name: str(card, 'name', 'Name') ?? '',
        age: age ?? null,
        photoUrl: str(card, 'photoUrl', 'PhotoUrl'),
        tags,
        matchPct,
      });
    }
  }

  return {
    kind,
    premiumMatchPreviewUsd,
    activity,
    deck,
  };
}

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

/** API may vary casing; treat any "live" variant as usable showcase data. */
export function isLandingShowcaseLive(data: LandingShowcaseResult | null | undefined): boolean {
  const k = (data?.kind ?? '').trim().toLowerCase();
  return k === 'live';
}

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
  const raw = await res.json();
  const data = normalizeLandingShowcasePayload(raw);
  if (!data) return null;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* ignore */
  }
  return data;
}
