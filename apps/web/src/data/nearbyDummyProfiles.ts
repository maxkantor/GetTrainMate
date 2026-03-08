import type { MatchFeedItem } from '@/services/matchService';
import type { IpLocation } from '@/services/locationService';

/** userId prefix for local demo cards (no backend like/pass). */
export const NEARBY_DUMMY_USER_PREFIX = 'local-near-';

export function isDummyNearbyProfile(userId: string): boolean {
  return userId.startsWith(NEARBY_DUMMY_USER_PREFIX);
}

/**
 * Two demo cards with real photos, appended at the end of Discover so all real
 * user-created profiles (Max, Alex, Sasha, etc.) show first.
 */
const DEMO_CARDS: MatchFeedItem[] = [
  {
    userId: `${NEARBY_DUMMY_USER_PREFIX}0`,
    name: 'Jordan',
    city: 'Near you',
    bio: 'Running and strength. Looking for a steady training buddy a few times a week.',
    sportTags: ['Running', 'Strength'],
    level: 'Intermediate',
    photoUrls: ['https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=600&q=80'],
    compatibilityScore: 78,
    commonSports: ['Running'],
    mode: 'TRAIN',
  },
  {
    userId: `${NEARBY_DUMMY_USER_PREFIX}1`,
    name: 'Sam',
    city: 'Near you',
    bio: 'Gym and CrossFit. Prefer morning sessions. Down for lifting or cardio.',
    sportTags: ['CrossFit', 'Gym'],
    level: 'Advanced',
    photoUrls: ['https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=600&q=80'],
    compatibilityScore: 72,
    commonSports: ['Gym'],
    mode: 'TRAIN',
  },
];

/** Returns 2 demo cards with real pictures; append after API feed so real users show first. */
export function buildDiscoverDemoCards(_location?: IpLocation): MatchFeedItem[] {
  return DEMO_CARDS.map((c) => ({ ...c }));
}

/** Get a single demo card by userId (for PublicProfile when viewing local-near-*). */
export function getDiscoverDemoCard(userId: string): MatchFeedItem | null {
  return DEMO_CARDS.find((c) => c.userId === userId) ?? null;
}
