/**
 * Mock profiles shown on the landing page. Each has a stable userId so
 * "View Profile" opens the correct person (e.g. Sofia → /app/profile/landing-sofia).
 */
export const LANDING_PROFILE_PREFIX = 'landing-';

export interface LandingProfile {
  userId: string;
  name: string;
  age: number;
  location: string;
  distance: string;
  tags: string[];
  schedule: string[];
  match: number;
  verified: boolean;
  avatar: string;
  bio: string;
}

export const LANDING_PROFILES: LandingProfile[] = [
  {
    userId: 'landing-sofia',
    name: 'Sofia',
    age: 29,
    location: 'Atlanta, GA',
    distance: '2.4 mi',
    tags: ['HYROX', 'Strength', '5K'],
    schedule: ['Mon/Wed', '6-8 PM'],
    match: 94,
    verified: true,
    avatar: '👩‍🦰',
    bio: 'Training for HYROX and local 5Ks. Looking for a consistent partner for strength and running.',
  },
  {
    userId: 'landing-marcus',
    name: 'Marcus',
    age: 32,
    location: 'Denver, CO',
    distance: '1.8 mi',
    tags: ['CrossFit', 'Running', 'Rowing'],
    schedule: ['Tue/Thu', '5-7 AM'],
    match: 89,
    verified: true,
    avatar: '🧔',
    bio: 'CrossFit and running. Prefer early morning sessions and race prep accountability.',
  },
  {
    userId: 'landing-aisha',
    name: 'Aisha',
    age: 27,
    location: 'Austin, TX',
    distance: '3.2 mi',
    tags: ['Yoga', 'HIIT', 'Cycling'],
    schedule: ['Daily', '7-9 PM'],
    match: 91,
    verified: false,
    avatar: '👩',
    bio: 'Yoga, HIIT, and cycling. Flexible schedule — let\'s find a time that works.',
  },
];

export function isLandingProfileUserId(userId: string): boolean {
  return userId.startsWith(LANDING_PROFILE_PREFIX);
}

export function getLandingProfile(userId: string): LandingProfile | undefined {
  return LANDING_PROFILES.find((p) => p.userId === userId);
}
