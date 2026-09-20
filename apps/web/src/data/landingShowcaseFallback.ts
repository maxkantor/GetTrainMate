/**
 * Offline fallbacks when /api/public/landing-showcase is unavailable.
 * Product mode cards only — never invent named users or fake match activity.
 */
import { DUMMY_USER_PRIMARY_PHOTO } from '@/utils/profilePhotos';

export type LandingStackFallbackItem = {
  text: string;
  avatar: string;
  secondaryAvatar?: string;
  mode?: 'TRAIN' | 'VIBE' | 'DATE';
};

/** Mode journey cards — used when live CRM showcase data is unavailable. */
export const LANDING_SHOWCASE_STACK_FALLBACK: LandingStackFallbackItem[] = [
  {
    mode: 'TRAIN',
    text: 'TRAIN — Find someone for your next workout.',
    avatar: DUMMY_USER_PRIMARY_PHOTO['dummy-user-1'],
  },
  {
    mode: 'VIBE',
    text: 'VIBE — Workout went well? Keep hanging out.',
    avatar: DUMMY_USER_PRIMARY_PHOTO['dummy-user-2'],
  },
  {
    mode: 'DATE',
    text: "DATE — There's chemistry? You decide what's next.",
    avatar: DUMMY_USER_PRIMARY_PHOTO['dummy-user-3'],
  },
];

export type LandingDeckFallback = {
  name: string;
  age: number;
  photo: string;
  tags: string[];
  matchPct: number;
};

/** Swipe demo placeholders — generic role labels, not fabricated social-proof names. */
export const LANDING_SHOWCASE_DECK_FALLBACK: LandingDeckFallback[] = [
  {
    name: 'Anna',
    age: 28,
    photo: DUMMY_USER_PRIMARY_PHOTO['dummy-user-1'],
    tags: ['RUNNING', 'YOGA', 'HIKING'],
    matchPct: 94,
  },
  {
    name: 'Marcus',
    age: 32,
    photo: DUMMY_USER_PRIMARY_PHOTO['dummy-user-2'],
    tags: ['CYCLING', 'GYM', 'CROSSFIT'],
    matchPct: 91,
  },
  {
    name: 'Maria',
    age: 27,
    photo: DUMMY_USER_PRIMARY_PHOTO['dummy-user-3'],
    tags: ['YOGA', 'PILATES', 'HIKING'],
    matchPct: 88,
  },
  {
    name: 'Anna',
    age: 28,
    photo: DUMMY_USER_PRIMARY_PHOTO['dummy-user-1'],
    tags: ['RUNNING', 'YOGA', 'HIKING'],
    matchPct: 92,
  },
  {
    name: 'Marcus',
    age: 32,
    photo: DUMMY_USER_PRIMARY_PHOTO['dummy-user-2'],
    tags: ['CYCLING', 'GYM', 'CROSSFIT'],
    matchPct: 89,
  },
  {
    name: 'Maria',
    age: 27,
    photo: DUMMY_USER_PRIMARY_PHOTO['dummy-user-3'],
    tags: ['YOGA', 'PILATES', 'HIKING'],
    matchPct: 90,
  },
];
