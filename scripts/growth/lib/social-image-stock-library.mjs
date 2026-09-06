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
      id: 'train-running-outdoor-9',
      unsplashId: 'photo-1552674605-db6ffd4facb5',
      scene: 'runners running outdoors together',
      activities: ['running', 'workout']
    },
    {
      id: 'train-running-prep-10',
      unsplashId: 'photo-1483721310020-03333e577078',
      scene: 'runner preparing for workout',
      activities: ['workout', 'running']
    },
    {
      id: 'train-swimming-fitness-11',
      unsplashId: 'photo-1528912599607-dc5f96f6c1d8',
      scene: 'swimmers pool training workout',
      activities: ['workout']
    }
  ],
  VIBE: [
    {
      id: 'vibe-friends-group-1',
      unsplashId: 'photo-1529156069898-49953e39b3ac',
      scene: 'friends hanging out together',
      activities: ['events', 'social', 'friendship']
    },
    {
      id: 'vibe-friends-laughing-2',
      unsplashId: 'photo-1511988617509-a57c8a288659',
      scene: 'group of friends laughing outdoors',
      activities: ['social', 'friendship', 'events']
    },
    {
      id: 'vibe-friends-park-3',
      unsplashId: 'photo-1517486808906-6ca8b3f04846',
      scene: 'friends socializing in the park',
      activities: ['social', 'events']
    },
    {
      id: 'vibe-friends-guys-4',
      unsplashId: 'photo-1543807535-eceef0bc6599',
      scene: 'friends laughing and chatting',
      activities: ['social', 'friendship']
    },
    {
      id: 'vibe-team-collab-5',
      unsplashId: 'photo-1522202176988-66273c2fd55f',
      scene: 'group of friends connecting at table',
      activities: ['friendship', 'social', 'events']
    },
    {
      id: 'vibe-celebrating-6',
      unsplashId: 'photo-1529333166437-7750a6dd5a70',
      scene: 'friends celebrating together',
      activities: ['events', 'social']
    },
    {
      id: 'vibe-outdoors-laugh-7',
      unsplashId: 'photo-1755705152604-af6804fb8932',
      scene: 'friends laughing outdoors together',
      activities: ['social', 'friendship']
    },
    {
      id: 'vibe-youth-group-8',
      unsplashId: 'photo-1539571696357-5a69c17a67c6',
      scene: 'friends walking in city',
      activities: ['social', 'friendship', 'events']
    },
    {
      id: 'vibe-social-smiles-9',
      unsplashId: 'photo-1492562080023-ab3db95bfbce',
      scene: 'friendly social connection',
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
      id: 'date-laughing-daytime-2',
      unsplashId: 'photo-1466979939565-131c4b39a51b',
      scene: 'couple laughing during daytime',
      activities: ['dating']
    },
    {
      id: 'date-smiling-together-3',
      unsplashId: 'photo-1663579167845-c73285e3805b',
      scene: 'couple smiling together',
      activities: ['dating']
    },
    {
      id: 'date-holding-hands-4',
      unsplashId: 'photo-1473867832923-830c92cece07',
      scene: 'couple walking holding hands',
      activities: ['dating']
    },
    {
      id: 'date-couple-portrait-5',
      unsplashId: 'photo-1524504388940-b1c1722653e1',
      scene: 'lifestyle portrait connection',
      activities: ['dating']
    },
    {
      id: 'date-laughing-close-6',
      unsplashId: 'photo-1746813629190-80f67d5050fa',
      scene: 'happy couple laughing together',
      activities: ['dating']
    },
    {
      id: 'date-smiling-man-7',
      unsplashId: 'photo-1522529599102-193c0d76b5b6',
      scene: 'warm smiling connection',
      activities: ['dating']
    },
    {
      id: 'date-active-lifestyle-8',
      unsplashId: 'photo-1571019614242-c5c5dee9f50b',
      scene: 'active athletic connection',
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
