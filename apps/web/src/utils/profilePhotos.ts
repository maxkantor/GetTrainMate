import { IMAGE_BUCKET_BASE } from '@/config/media';

/**
 * Placeholder images: each profile gets multiple different images of the SAME person
 * (e.g. Sofia = 4 different shots of one woman, not 4 different women).
 * One "person" per profile (by hash); 4 crops of that person's photo = 4 different images.
 */
const DEFAULT_PHOTO_COUNT = 4;

const UNSPLASH_BASE = 'https://images.unsplash.com';
/** Fallback when Unsplash is blocked; seed by userId for stable "same person" per profile. */
const PICSUM_BASE = 'https://picsum.photos/seed';

/** Backend uses randomuser.me when profile has no photo — these are random people, not the user. */
const BACKEND_PLACEHOLDER_HOST = 'randomuser.me';

/** Resolve S3 key or relative path to a browser-loadable URL. */
export function resolveProfilePhotoUrl(url: string | undefined | null): string | null {
  if (!url?.trim()) return null;
  const u = url.trim();
  if (isBackendPlaceholderPhotoUrl(u)) return null;
  if (/^https?:\/\//i.test(u) || u.startsWith('data:')) return u;
  return `${IMAGE_BUCKET_BASE}/${u.replace(/^\//, '')}`;
}

/** Map GraphQL avatarUrl / photoUrls entry to a resolved URL list. */
export function photoUrlsFromAvatarField(avatarUrl: string | undefined | null): string[] {
  const resolved = resolveProfilePhotoUrl(avatarUrl);
  return resolved ? [resolved] : [];
}

/** First real uploaded photo — excludes backend randomuser.me placeholders. */
export function getRealPrimaryPhotoUrl(photoUrls: string[] | undefined | null): string | null {
  const real = (photoUrls ?? []).filter((u) => u?.trim() && !isBackendPlaceholderPhotoUrl(u));
  for (const u of real) {
    const resolved = resolveProfilePhotoUrl(u);
    if (resolved) return resolved;
  }
  return null;
}

/** Extract S3 object key from a profile photo URL or raw key string. */
export function profilePhotoStorageKey(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return trimmed.replace(/^\//, '');
  try {
    const host = new URL(trimmed).hostname;
    if (!host.includes('amazonaws.com')) return null;
    return new URL(trimmed).pathname.replace(/^\//, '');
  } catch {
    return null;
  }
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement | null> {
  const objectUrl = URL.createObjectURL(blob);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };
    img.src = objectUrl;
  });
}

/** Load a profile photo for canvas export — uses same-origin API to avoid S3 CORS. */
export async function fetchProfilePhotoForCanvas(
  photoUrls: string[] | undefined | null,
  options?: { token?: string | null; displayUrl?: string | null },
): Promise<HTMLImageElement | null> {
  const raw = getRealPrimaryPhotoUrl(photoUrls);
  const key = raw ? profilePhotoStorageKey(raw) : null;

  if (options?.token && key) {
    try {
      const { profileService } = await import('@/services/profileService');
      const blob = await profileService.fetchPhotoBlob(options.token, key);
      const img = await loadImageFromBlob(blob);
      if (img) return img;
    } catch {
      /* try direct URL below */
    }
  }

  const url = options?.displayUrl || (raw ? resolveProfilePhotoUrl(raw) : null);
  if (!url) return null;

  try {
    const res = await fetch(url);
    if (res.ok) {
      const img = await loadImageFromBlob(await res.blob());
      if (img) return img;
    }
  } catch {
    /* fall through */
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Returns true if URL is a backend placeholder (random person), not the user's real photo. */
export function isBackendPlaceholderPhotoUrl(url: string | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const host = new URL(url).hostname;
    return host.includes(BACKEND_PLACEHOLDER_HOST);
  } catch {
    return false;
  }
}

/** Discover showed Unsplash/dummy when CRM had real S3 photos — use to trigger REST hydration. */
export function isLikelyStockDiscoverPhoto(url: string | undefined, userId: string): boolean {
  if (!url) return true;
  if (isBackendPlaceholderPhotoUrl(url)) return true;
  if (/images\.unsplash\.com|picsum\.photo/i.test(url)) return true;
  if (userId && DUMMY_USER_PRIMARY_PHOTO[userId] === url) return true;
  return false;
}

/** Neutral "no photo" placeholder — gray silhouette, no face. Use when profile has no real photo. */
export const NO_PHOTO_PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500"><rect fill="#e5e7eb" width="400" height="500"/><circle cx="200" cy="180" r="80" fill="#9ca3af"/><ellipse cx="200" cy="420" rx="120" ry="80" fill="#9ca3af"/><text x="200" y="260" font-family="sans-serif" font-size="14" fill="#6b7280" text-anchor="middle">No photo yet</text></svg>'
);

/** One photo ID per "person" – women. Same person = same ID for all 4 slots; we vary crop. */
const FEMALE_PERSON_IDS = [
  'photo-1494790108377-be29c4feef6e',
  'photo-1580489944761-15a19d654956',
  'photo-1438761681033-6461ffad8d80',
  'photo-1544005313-94ddf0286df2',
  'photo-1573496359142-b8d87734a5a2',
  'photo-1524504386975-2f1f39a2b0c7',
  'photo-1517841905240-472988babdf9',
  'photo-1529626455592-4c4e2b0e7b6a',
];

/** One photo ID per "person" – men. All entries must be unique (duplicates caused two dummy users to share Mike Cyclist’s face). */
const MALE_PERSON_IDS = [
  'photo-1506794778202-cad84cf45f1d',
  'photo-1507003211169-0a1dd7228f2d',
  'photo-1472099645785-5658abf4ff4e',
  'photo-1500648767791-00dcc994a43e',
  'photo-1519085360753-af0119f7cbe7',
  'photo-1566492031773-4f4e44671857',
  'photo-1560250097-0b93528c311a',
  'photo-1570295995919-56ce5e9b81d5',
];

/** Different crops of the same photo = "different images of the same person". */
const CROPS = ['faces', 'top', 'bottom', 'entropy'] as const;

/**
 * Seeded test users: fixed cover URLs (aligned with `DummyProfilePhotos` in the API).
 * Used when the profile has no real photos (or only filtered randomuser.me placeholders).
 */
export const DUMMY_USER_PRIMARY_PHOTO: Record<string, string> = {
  'dummy-user-1': 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=600&q=80',
  'dummy-user-2': 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=600&q=80',
  'dummy-user-3': 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&q=80',
  'dummy-user-4': 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&q=80',
  'dummy-user-5': 'https://images.unsplash.com/photo-1622163642998-27549003c62e?w=600&q=80',
  'dummy-user-6': 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&q=80',
  'dummy-user-7': 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=600&q=80',
  'dummy-user-8': 'https://images.unsplash.com/photo-1530549387789-4c101f663662?w=600&q=80',
};

export type GenderHint = 'female' | 'male';

/** Infer gender from display name (first word) for placeholder selection. */
export function inferGenderFromName(displayName: string): GenderHint {
  const first = (displayName || '').trim().split(/\s+/)[0]?.toLowerCase() || '';
  const femaleNames = new Set([
    'sarah', 'emma', 'maria', 'aisha', 'sofia', 'jordan', 'casey', 'morgan', 'riley',
    'avery', 'jamie', 'taylor', 'reese', 'skyler', 'quinn', 'jessica', 'olivia',
    'sophia', 'isabella', 'mia', 'charlotte', 'amelia', 'harper', 'evelyn',
  ]);
  return femaleNames.has(first) ? 'female' : 'male';
}

/**
 * One placeholder image for (userId, index, gender). Same userId = same "person";
 * index 0–3 = different crop of that person's photo so it's "different images of Sofia", not different people.
 */
export function placeholderPhotoUrl(userId: string, index: number, gender: GenderHint = 'male'): string {
  const n = userId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const personIds = gender === 'female' ? FEMALE_PERSON_IDS : MALE_PERSON_IDS;
  const personIndex = n % personIds.length;
  const photoId = personIds[personIndex];
  const crop = CROPS[index % CROPS.length];
  return `${UNSPLASH_BASE}/${photoId}?w=600&h=800&fit=crop&crop=${crop}&q=85`;
}

/** Fallback placeholder when Unsplash is blocked (e.g. corporate firewall). Same seed = same image. */
export function fallbackPlaceholderPhotoUrl(userId: string, index: number): string {
  const seed = userId.split('').reduce((a, b) => a + b.charCodeAt(0), 0) + index * 31;
  return `${PICSUM_BASE}/${seed}/600/800`;
}

/**
 * Returns an array of photo URLs for the carousel.
 * - If profile has real photos: return ONLY those — never pad with placeholders.
 *   (Padding caused "another person" bug when swiping to slots 2–4.)
 * - Backend placeholder URLs (randomuser.me) are filtered out — they show random people, not the user.
 * - If profile has zero real photos: return Unsplash placeholder (user will see a face; onError can try picsum fallback).
 */
export function getMultiplePhotoUrls(
  existingUrls: string[] | undefined,
  userId: string,
  _count: number = DEFAULT_PHOTO_COUNT,
  displayName?: string
): string[] {
  const raw = (existingUrls ?? []).filter(Boolean);
  const existing = raw.filter((u) => !isBackendPlaceholderPhotoUrl(u));
  if (existing.length > 0) return existing;
  const dummy = userId && DUMMY_USER_PRIMARY_PHOTO[userId];
  if (dummy) return [dummy];
  return [placeholderPhotoUrl(userId, 0, inferGenderFromName(displayName || 'Guest'))];
}
