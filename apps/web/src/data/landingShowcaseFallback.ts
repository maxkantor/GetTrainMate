/**
 * Offline fallbacks when /api/public/landing-showcase is unavailable, or when the API
 * returns only stock/placeholder URLs (we still show curated demo faces — not CRM S3).
 * Use base URLs only — sizing is CSS (`object-fit`). Never append query params to S3
 * presigned URLs (that invalidates signatures and shows broken images).
 */
import { DUMMY_USER_PRIMARY_PHOTO } from '@/utils/profilePhotos';

export type LandingStackFallbackItem = {
  text: string;
  avatar: string;
  secondaryAvatar?: string;
};

export const LANDING_SHOWCASE_STACK_FALLBACK: LandingStackFallbackItem[] = [
  {
    text: 'Sarah found someone to train and vibe with',
    avatar: DUMMY_USER_PRIMARY_PHOTO['dummy-user-1'],
    secondaryAvatar: DUMMY_USER_PRIMARY_PHOTO['dummy-user-2'],
  },
  {
    text: 'Mike matched this week',
    avatar: DUMMY_USER_PRIMARY_PHOTO['dummy-user-2'],
  },
  {
    text: 'New matches daily for training, vibes, or dating',
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

export const LANDING_SHOWCASE_DECK_FALLBACK: LandingDeckFallback[] = [
  {
    name: 'Sarah Runner',
    age: 28,
    photo: DUMMY_USER_PRIMARY_PHOTO['dummy-user-1'],
    tags: ['RUNNING', 'YOGA', 'HIKING'],
    matchPct: 94,
  },
  {
    name: 'Mike Cyclist',
    age: 32,
    photo: DUMMY_USER_PRIMARY_PHOTO['dummy-user-2'],
    tags: ['CYCLING', 'GYM', 'CROSSFIT'],
    matchPct: 91,
  },
  {
    name: 'Emma Yoga',
    age: 27,
    photo: DUMMY_USER_PRIMARY_PHOTO['dummy-user-3'],
    tags: ['YOGA', 'PILATES', 'MEDITATION'],
    matchPct: 88,
  },
  {
    name: 'Sarah Runner',
    age: 28,
    photo: DUMMY_USER_PRIMARY_PHOTO['dummy-user-1'],
    tags: ['RUNNING', 'YOGA', 'HIKING'],
    matchPct: 92,
  },
  {
    name: 'Mike Cyclist',
    age: 32,
    photo: DUMMY_USER_PRIMARY_PHOTO['dummy-user-2'],
    tags: ['CYCLING', 'GYM', 'CROSSFIT'],
    matchPct: 89,
  },
  {
    name: 'Emma Yoga',
    age: 27,
    photo: DUMMY_USER_PRIMARY_PHOTO['dummy-user-3'],
    tags: ['YOGA', 'PILATES', 'MEDITATION'],
    matchPct: 90,
  },
];
