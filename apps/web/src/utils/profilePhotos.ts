/**
 * Placeholder images: each profile gets multiple different images of the SAME person
 * (e.g. Sofia = 4 different shots of one woman, not 4 different women).
 * One "person" per profile (by hash); 4 crops of that person's photo = 4 different images.
 */
const DEFAULT_PHOTO_COUNT = 4;

const UNSPLASH_BASE = 'https://images.unsplash.com';

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

/** One photo ID per "person" – men. */
const MALE_PERSON_IDS = [
  'photo-1506794778202-cad84cf45f1d',
  'photo-1507003211169-0a1dd7228f2d',
  'photo-1472099645785-5658abf4ff4e',
  'photo-1500648767791-00dcc994a43e',
  'photo-1519085360753-af0119f7cbe7',
  'photo-1566492031773-4f4e44671857',
  'photo-1506794778202-cad84cf45f1d',
  'photo-1507003211169-0a1dd7228f2d',
];

/** Different crops of the same photo = "different images of the same person". */
const CROPS = ['faces', 'top', 'bottom', 'entropy'] as const;

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

/**
 * Returns an array of photo URLs for the carousel.
 * - If profile has real photos: return ONLY those — never pad with placeholders.
 *   (Padding caused "another person" bug when swiping to slots 2–4.)
 * - If profile has zero photos: return placeholders (same person, different crops).
 * Pass displayName (or first name) so placeholders match female vs male.
 */
export function getMultiplePhotoUrls(
  existingUrls: string[] | undefined,
  userId: string,
  count: number = DEFAULT_PHOTO_COUNT,
  displayName?: string
): string[] {
  const existing = (existingUrls ?? []).filter(Boolean);
  // Never pad with placeholders when we have real photos — avoids showing wrong person
  if (existing.length > 0) return existing;
  const gender = displayName ? inferGenderFromName(displayName) : 'male';
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(placeholderPhotoUrl(userId, i, gender));
  }
  return result;
}
