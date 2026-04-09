/**
 * Marketing-only profiles for "View profile" before signup. Aligned with seeded test users
 * (dummy-user-1…3 in MatchService.SeedDemoProfilesAsync); photos use the same URLs as the API.
 */
export const LANDING_PROFILE_PREFIX = 'landing-';

export interface LandingProfile {
  userId: string;
  /** When set, photo carousel uses DummyProfilePhotos for this id (see profilePhotos.ts). */
  seedUserId: string;
  name: string;
  age: number;
  location: string;
  distance: string;
  tags: string[];
  schedule: string[];
  match: number;
  verified: boolean;
  /** Legacy emoji slot — not used when seedUserId resolves real URLs. */
  avatar: string;
  bio: string;
}

/** Old slugs → current ids (bookmarks to /profile/landing-sofia still work). */
const LEGACY_LANDING_IDS: Record<string, string> = {
  'landing-sofia': 'landing-sarah',
  'landing-marcus': 'landing-mike',
  'landing-aisha': 'landing-emma',
};

export const LANDING_PROFILES: LandingProfile[] = [
  {
    userId: 'landing-sarah',
    seedUserId: 'dummy-user-1',
    name: 'Sarah',
    age: 28,
    location: 'San Francisco, CA',
    distance: '2.4 mi',
    tags: ['Running', 'Yoga', 'Hiking'],
    schedule: ['Mon/Wed/Fri', '6–8 PM'],
    match: 94,
    verified: true,
    avatar: '👩‍🦰',
    bio: 'Marathon runner looking for training partners. Love long runs on weekends!',
  },
  {
    userId: 'landing-mike',
    seedUserId: 'dummy-user-2',
    name: 'Mike',
    age: 32,
    location: 'San Francisco, CA',
    distance: '1.8 mi',
    tags: ['Cycling', 'Gym', 'CrossFit'],
    schedule: ['Sat/Sun', '8 AM–12 PM'],
    match: 89,
    verified: true,
    avatar: '🧔',
    bio: 'Cycling enthusiast. Looking for weekend ride buddies.',
  },
  {
    userId: 'landing-emma',
    seedUserId: 'dummy-user-3',
    name: 'Emma',
    age: 27,
    location: 'San Francisco, CA',
    distance: '3.2 mi',
    tags: ['Yoga', 'Pilates', 'Meditation'],
    schedule: ['Mon/Wed/Fri', '6–8 AM'],
    match: 91,
    verified: false,
    avatar: '👩',
    bio: 'Yoga instructor and fitness enthusiast. Love morning yoga sessions!',
  },
];

export function isLandingProfileUserId(userId: string): boolean {
  return userId.startsWith(LANDING_PROFILE_PREFIX);
}

export function getLandingProfile(userId: string): LandingProfile | undefined {
  const id = LEGACY_LANDING_IDS[userId] ?? userId;
  return LANDING_PROFILES.find((p) => p.userId === id);
}
