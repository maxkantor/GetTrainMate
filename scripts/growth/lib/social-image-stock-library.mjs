/**
 * GetTrainMate-owned social stock catalog — vetted Unsplash IDs only.
 * Sources: DummyProfilePhotos, pricing fallbacks (media.ts), live URL probes.
 * Every entry must be fitness, social hangout, or dating — no unrelated stock.
 */
export const STOCK_PHOTOS = {
  TRAIN: [
    {
      id: 'train-gym-woman-1',
      unsplashId: 'photo-1571019614242-c5c5dee9f50b',
      scene: 'woman training in gym',
      activities: ['workout', 'gym', 'accountability']
    },
    {
      id: 'train-gym-man-2',
      unsplashId: 'photo-1568602471122-7832951cc4c5',
      scene: 'man fitness training',
      activities: ['workout', 'gym', 'running']
    },
    {
      id: 'train-gym-weights-3',
      unsplashId: 'photo-1517836357463-d25dfeac3438',
      scene: 'gym strength training',
      activities: ['workout', 'gym', 'accountability']
    },
    {
      id: 'train-gym-studio-4',
      unsplashId: 'photo-1534438327276-14e5300c3a48',
      scene: 'gym workout session',
      activities: ['workout', 'gym']
    },
    {
      id: 'train-gym-session-5',
      unsplashId: 'photo-1574680096145-d05b474e2155',
      scene: 'gym exercise',
      activities: ['workout', 'gym']
    },
    {
      id: 'train-gym-woman-6',
      unsplashId: 'photo-1594381898411-846e7d193883',
      scene: 'woman gym workout',
      activities: ['workout', 'gym']
    },
    {
      id: 'train-yoga-outdoor-7',
      unsplashId: 'photo-1544367567-0f2fcb009e0b',
      scene: 'outdoor yoga workout',
      activities: ['workout', 'running']
    },
    {
      id: 'train-yoga-studio-8',
      unsplashId: 'photo-1506126613408-eca07ce68773',
      scene: 'yoga training',
      activities: ['workout', 'gym']
    },
    {
      id: 'train-running-9',
      unsplashId: 'photo-1470225620780-dba8ba36b745',
      scene: 'outdoor running',
      activities: ['running', 'workout']
    },
    {
      id: 'train-cycling-10',
      unsplashId: 'photo-1574629810360-7efbbe195018',
      scene: 'cycling training',
      activities: ['workout', 'running']
    },
    {
      id: 'train-swim-11',
      unsplashId: 'photo-1544551763-46a013bb70d5',
      scene: 'swim training',
      activities: ['workout']
    }
  ],
  VIBE: [
    {
      id: 'vibe-friends-group-1',
      unsplashId: 'photo-1529156069898-49953e39b3ac',
      scene: 'friends hanging out',
      activities: ['events', 'social', 'friendship']
    },
    {
      id: 'vibe-city-explore-2',
      unsplashId: 'photo-1488646953014-85cb44e25828',
      scene: 'friends exploring city',
      activities: ['events', 'social']
    },
    {
      id: 'vibe-cafe-3',
      unsplashId: 'photo-1495474472287-4d71bcdd2085',
      scene: 'cafe meetup',
      activities: ['social', 'friendship', 'events']
    },
    {
      id: 'vibe-brunch-4',
      unsplashId: 'photo-1414235077428-338989a2e8c0',
      scene: 'brunch with friends',
      activities: ['social', 'events']
    },
    {
      id: 'vibe-lounge-5',
      unsplashId: 'photo-1522771739844-6a9f6d5f14af',
      scene: 'social lounge hangout',
      activities: ['social', 'friendship']
    },
    {
      id: 'vibe-team-6',
      unsplashId: 'photo-1522202176988-66273c2fd55f',
      scene: 'group collaboration',
      activities: ['friendship', 'social', 'events']
    },
    {
      id: 'vibe-restaurant-7',
      unsplashId: 'photo-1517248135467-4c7edcad34c4',
      scene: 'restaurant hangout',
      activities: ['events', 'social']
    },
    {
      id: 'vibe-cooking-8',
      unsplashId: 'photo-1556910103-1c02745aae4d',
      scene: 'cooking together',
      activities: ['social', 'friendship']
    },
    {
      id: 'vibe-rooftop-9',
      unsplashId: 'photo-1470225620780-dba8ba36b745',
      scene: 'active social outdoors',
      activities: ['events', 'social']
    }
  ],
  DATE: [
    {
      id: 'date-walk-1',
      unsplashId: 'photo-1516589178581-6cd7833ae3b2',
      scene: 'couple walking together',
      activities: ['dating']
    },
    {
      id: 'date-portrait-2',
      unsplashId: 'photo-1524504388940-b1c1722653e1',
      scene: 'couple portrait',
      activities: ['dating']
    },
    {
      id: 'date-bar-3',
      unsplashId: 'photo-1514933651103-005eec06c04b',
      scene: 'date night drinks',
      activities: ['dating']
    },
    {
      id: 'date-dinner-4',
      unsplashId: 'photo-1559339352-11d035aa65de',
      scene: 'dinner date',
      activities: ['dating']
    },
    {
      id: 'date-beach-5',
      unsplashId: 'photo-1502680390469-be75c86b636f',
      scene: 'beach date walk',
      activities: ['dating']
    },
    {
      id: 'date-coffee-6',
      unsplashId: 'photo-1495474472287-4d71bcdd2085',
      scene: 'coffee date',
      activities: ['dating']
    },
    {
      id: 'date-brunch-7',
      unsplashId: 'photo-1414235077428-338989a2e8c0',
      scene: 'brunch date',
      activities: ['dating']
    },
    {
      id: 'date-active-8',
      unsplashId: 'photo-1571019614242-c5c5dee9f50b',
      scene: 'active lifestyle date',
      activities: ['dating']
    }
  ]
};

export function unsplashCropUrl(unsplashId, { width = 1080, height = 1350 } = {}) {
  const id = String(unsplashId || '').trim();
  if (!/^photo-[a-z0-9-]+$/i.test(id)) {
    throw new Error(`invalid_unsplash_id:${id}`);
  }
  return `https://images.unsplash.com/${id}?w=${width}&h=${height}&fit=crop&q=85&auto=format`;
}

export function stockPhotosForMode(mode) {
  return STOCK_PHOTOS[String(mode || 'TRAIN').toUpperCase()] || STOCK_PHOTOS.TRAIN;
}

export function allStockPhotos() {
  return Object.entries(STOCK_PHOTOS).flatMap(([mode, photos]) =>
    photos.map((photo) => ({ ...photo, mode }))
  );
}

export function validateStockPhotoEntry(photo) {
  const issues = [];
  if (!photo?.id) issues.push('missing_id');
  if (!photo?.unsplashId || !/^photo-[a-z0-9-]+$/i.test(photo.unsplashId)) issues.push('bad_unsplash_id');
  if (!photo?.scene) issues.push('missing_scene');
  if (!Array.isArray(photo?.activities) || !photo.activities.length) issues.push('missing_activities');
  return issues;
}
