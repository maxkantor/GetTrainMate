/**
 * Canonical training / sport tags for Profile and Admin CRM (must stay in sync).
 * Order is used for stable display and CRM checkbox sorting.
 */
export const PROFILE_SPORTS: readonly string[] = [
  'Running',
  'Cycling',
  'Swimming',
  'Walking',
  'Tennis',
  'Basketball',
  'Soccer',
  'Volleyball',
  'Gym',
  'Yoga',
  'Hiking',
  'Climbing',
  'CrossFit',
  'Hyrox',
  'Pickleball',
  'Fishing',
  'Boxing',
  'MMA',
  'Dancing',
  'Golf',
  'Skiing',
  'Surfing',
  'Rowing',
  'Paddleboarding',
  'Rock Climbing',
  'Martial Arts',
  'Pilates',
  'Barre',
  'HIIT',
  'Powerlifting',
  'Weightlifting',
  'Rugby',
  'Baseball',
  'Softball',
  'Badminton',
  'Squash',
  'Racquetball',
  'Table Tennis',
  'Archery',
  'Kayaking',
  'Canoeing',
  'Triathlon',
  'Ultramarathon',
] as const;

/** Match free-typed tags to canonical labels (case-insensitive). Unknown tags are dropped for checkbox UI. */
export function normalizeSportTagsToCanonical(raw: string): string[] {
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  const lower = new Map(PROFILE_SPORTS.map((s) => [s.toLowerCase(), s] as const));
  for (const p of parts) {
    const hit = lower.get(p.toLowerCase());
    if (hit && !out.includes(hit)) out.push(hit);
  }
  return out;
}

export function sortSportsByProfileOrder(tags: string[]): string[] {
  const rank = (s: string) => {
    const i = PROFILE_SPORTS.indexOf(s);
    return i === -1 ? 9999 : i;
  };
  return [...tags].sort((a, b) => rank(a) - rank(b));
}
