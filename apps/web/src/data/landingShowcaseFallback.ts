/**
 * Offline / API-failure fallbacks for the landing hero. Uses the same seeded test users
 * as the API (`dummy-user-*` + DummyProfilePhotos) — not unrelated stock personas.
 */
import { DUMMY_USER_PRIMARY_PHOTO } from '@/utils/profilePhotos';

function cropThumb(url: string): string {
  const u = url.trim();
  if (!u) return u;
  return u.includes('?') ? `${u}&w=120&h=120&fit=crop&crop=faces` : `${u}?w=120&h=120&fit=crop&crop=faces`;
}

export type LandingStackFallbackItem = {
  text: string;
  avatar: string;
  secondaryAvatar?: string;
};

/** Matches copy patterns in LandingMatchPreviewService.BuildShowcaseActivityAsync fallback lines. */
export const LANDING_SHOWCASE_STACK_FALLBACK: LandingStackFallbackItem[] = [
  {
    text: 'Sarah matched with Mike',
    avatar: cropThumb(DUMMY_USER_PRIMARY_PHOTO['dummy-user-1']),
    secondaryAvatar: cropThumb(DUMMY_USER_PRIMARY_PHOTO['dummy-user-2']),
  },
  {
    text: 'Mike found a training partner',
    avatar: cropThumb(DUMMY_USER_PRIMARY_PHOTO['dummy-user-2']),
  },
  {
    text: 'New training partners every week',
    avatar: cropThumb(DUMMY_USER_PRIMARY_PHOTO['dummy-user-3']),
  },
];

export type LandingDeckFallback = {
  name: string;
  age: number;
  photo: string;
  tags: string[];
  matchPct: number;
};

/** Deck swipe demo — aligned with MatchService.SeedDemoProfilesAsync (sports/tags). */
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
