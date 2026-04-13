/**
 * Offline fallbacks when /api/public/landing-showcase is unavailable.
 */
import { NO_PHOTO_PLACEHOLDER } from '@/utils/profilePhotos';

export type LandingStackFallbackItem = {
  text: string;
  avatar: string;
  secondaryAvatar?: string;
};

export const LANDING_SHOWCASE_STACK_FALLBACK: LandingStackFallbackItem[] = [
  {
    text: 'Sarah found a training partner',
    avatar: NO_PHOTO_PLACEHOLDER,
    secondaryAvatar: NO_PHOTO_PLACEHOLDER,
  },
  {
    text: 'Mike matched this week',
    avatar: NO_PHOTO_PLACEHOLDER,
  },
  {
    text: 'New training partners added regularly',
    avatar: NO_PHOTO_PLACEHOLDER,
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
    photo: NO_PHOTO_PLACEHOLDER,
    tags: ['RUNNING', 'YOGA', 'HIKING'],
    matchPct: 94,
  },
  {
    name: 'Mike Cyclist',
    age: 32,
    photo: NO_PHOTO_PLACEHOLDER,
    tags: ['CYCLING', 'GYM', 'CROSSFIT'],
    matchPct: 91,
  },
  {
    name: 'Emma Yoga',
    age: 27,
    photo: NO_PHOTO_PLACEHOLDER,
    tags: ['YOGA', 'PILATES', 'MEDITATION'],
    matchPct: 88,
  },
  {
    name: 'Sarah Runner',
    age: 28,
    photo: NO_PHOTO_PLACEHOLDER,
    tags: ['RUNNING', 'YOGA', 'HIKING'],
    matchPct: 92,
  },
  {
    name: 'Mike Cyclist',
    age: 32,
    photo: NO_PHOTO_PLACEHOLDER,
    tags: ['CYCLING', 'GYM', 'CROSSFIT'],
    matchPct: 89,
  },
  {
    name: 'Emma Yoga',
    age: 27,
    photo: NO_PHOTO_PLACEHOLDER,
    tags: ['YOGA', 'PILATES', 'MEDITATION'],
    matchPct: 90,
  },
];
