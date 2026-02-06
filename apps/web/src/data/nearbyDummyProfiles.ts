import type { MatchFeedItem } from '@/services/matchService';
import { getMultiplePhotoUrls } from '@/utils/profilePhotos';
import type { IpLocation } from '@/services/locationService';

/** userId prefix for local dummy profiles (no backend like/pass). */
export const NEARBY_DUMMY_USER_PREFIX = 'local-near-';

export function isDummyNearbyProfile(userId: string): boolean {
  return userId.startsWith(NEARBY_DUMMY_USER_PREFIX);
}

const DUMMY_NAMES = [
  'Jordan', 'Sam', 'Alex', 'Casey', 'Morgan', 'Riley', 'Quinn', 'Avery',
  'Jamie', 'Taylor', 'Reese', 'Drew', 'Blake', 'Cameron', 'Skyler',
];
const DUMMY_BIOS = [
  'Looking for a running buddy a few times a week.',
  'Gym regular, prefer mornings. Down for lifting or cardio.',
  'Training for a half marathon. Would love a consistent partner.',
  'Casual runner and hiker. Prefer outdoor workouts.',
  'Into strength and conditioning. Let\'s keep each other accountable.',
];
const DUMMY_SPORTS = ['Running', 'Strength', 'Yoga', 'Cycling', 'HIIT', 'Swimming', 'Hiking', 'CrossFit'];
const DUMMY_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const DUMMY_MODES = ['TRAIN', 'VIBE', 'DATE'];

/** Generate 6–8 dummy profiles "near" the user's location. */
export function buildNearbyDummyProfiles(location: IpLocation): MatchFeedItem[] {
  const count = 6;
  const items: MatchFeedItem[] = [];
  const city = location.city || location.label || 'Near you';
  for (let i = 0; i < count; i++) {
    const userId = `${NEARBY_DUMMY_USER_PREFIX}${i}`;
    const nameIdx = (location.lat + location.lon + i) % DUMMY_NAMES.length;
    const name = DUMMY_NAMES[nameIdx];
    const sportCount = 2 + (i % 3);
    const sports: string[] = [];
    const used = new Set<number>();
    while (sports.length < sportCount) {
      const k = (i * 7 + sports.length) % DUMMY_SPORTS.length;
      if (!used.has(k)) {
        used.add(k);
        sports.push(DUMMY_SPORTS[k]);
      }
    }
    const photoUrls = getMultiplePhotoUrls(undefined, userId, 4, name);
    items.push({
      userId,
      name,
      city: `${city} · Nearby`,
      bio: DUMMY_BIOS[i % DUMMY_BIOS.length],
      sportTags: sports,
      level: DUMMY_LEVELS[i % DUMMY_LEVELS.length],
      photoUrls,
      compatibilityScore: 72 + (i % 18),
      commonSports: sports.slice(0, 2),
      mode: DUMMY_MODES[i % DUMMY_MODES.length],
    });
  }
  return items;
}
