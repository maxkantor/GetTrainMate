/**
 * GetTrainMate-owned social stock catalog — vetted Unsplash IDs only.
 * Every entry must be fitness/training partners, social hangout/activities, or romantic dates.
 * All people must be adults.
 *
 * HARD EXCLUSIONS:
 * For VIBE, NEVER include:
 * - laptops, computers, desks
 * - office meetings, coworking, business meetings, conference rooms
 * - people working, people studying
 * - corporate networking imagery
 */

export const PROHIBITED_VIBE_KEYWORDS = [
  'laptop',
  'office',
  'coworking',
  'business',
  'conference',
  'working',
  'studying',
  'corporate',
  'computer',
  'desk'
];

export const STOCK_PHOTOS = {
  TRAIN: [
    {
      id: 'train-gym-partners-goals',
      unsplashId: 'photo-1758875569399-99a7d80ace43',
      scene: 'training partners in gym planning workout goals together',
      activities: ['workout', 'gym', 'accountability', 'partner', 'goals', 'fitness']
    },
    {
      id: 'train-pickleball-match',
      unsplashId: 'photo-1761644518970-2ed0ab543e1b',
      scene: 'pickleball partners playing an active doubles match',
      activities: ['pickleball', 'sports', 'tennis', 'partner', 'workout']
    },
    {
      id: 'train-pickleball-doubles',
      unsplashId: 'photo-1761644658016-324918bc373c',
      scene: 'pickleball players competing together on indoor court',
      activities: ['pickleball', 'sports', 'partner', 'workout']
    },
    {
      id: 'train-tennis-court-action',
      unsplashId: 'photo-1622279457486-62dcc4a431d6',
      scene: 'athletic tennis player moving dynamically on outdoor court',
      activities: ['tennis', 'sports', 'court', 'partner']
    },
    {
      id: 'train-tennis-player-lifestyle',
      unsplashId: 'photo-1595435934249-5df7ed86e1c0',
      scene: 'tennis player resting on blue court with racket and balls',
      activities: ['tennis', 'sports', 'workout']
    },
    {
      id: 'train-running-outdoor-group',
      unsplashId: 'photo-1552674605-db6ffd4facb5',
      scene: 'runners running together outdoors at golden hour',
      activities: ['running', 'workout', 'cardio', 'partner']
    },
    {
      id: 'train-cycling-road-partners',
      unsplashId: 'photo-1541625602330-2277a4c46182',
      scene: 'cyclists riding road bikes together along coastal route',
      activities: ['cycling', 'bike', 'workout', 'partner']
    },
    {
      id: 'train-functional-gym-class',
      unsplashId: 'photo-1518611012118-696072aa579a',
      scene: 'functional fitness workout partners in bright studio',
      activities: ['workout', 'gym', 'functional', 'partner']
    },
    {
      id: 'train-gym-strength-lifting',
      unsplashId: 'photo-1517836357463-d25dfeac3438',
      scene: 'athlete deadlifting heavy barbell in modern gym',
      activities: ['workout', 'gym', 'strength', 'weights']
    }
  ],
  VIBE: [
    {
      id: 'vibe-friends-patio-dining',
      unsplashId: 'photo-1528605248644-14dd04022da1',
      scene: 'friends enjoying social meal and drinks at outdoor patio restaurant',
      activities: ['dining', 'restaurant', 'food', 'social', 'drinks', 'friends', 'events']
    },
    {
      id: 'vibe-cafe-coffee-culture',
      unsplashId: 'photo-1525610553991-2bede1a236e2',
      scene: 'friends socializing at counter of modern coffee shop with barista',
      activities: ['coffee', 'cafe', 'social', 'friends', 'meetup']
    },
    {
      id: 'vibe-cocktail-toast-night',
      unsplashId: 'photo-1617524455617-ce1e266aa810',
      scene: 'friends toasting craft cocktails in moody bar at night',
      activities: ['drinks', 'cocktails', 'nightlife', 'bar', 'social', 'rooftop']
    },
    {
      id: 'vibe-wine-celebration-toast',
      unsplashId: 'photo-1519671482749-fd09be7ccebf',
      scene: 'group of friends clinking wine glasses in warm evening toast',
      activities: ['drinks', 'celebration', 'social', 'nightlife', 'party']
    },
    {
      id: 'vibe-friends-rooftop-sunset',
      unsplashId: 'photo-1529333166437-7750a6dd5a70',
      scene: 'friends celebrating on rooftop overlooking city at sunset',
      activities: ['rooftop', 'sunset', 'social', 'city', 'events', 'celebration']
    },
    {
      id: 'vibe-hiking-mountain-trail',
      unsplashId: 'photo-1551632811-561732d1e306',
      scene: 'friends hiking mountain trail toward scenic alpine peak',
      activities: ['hiking', 'outdoors', 'nature', 'trail', 'adventure']
    },
    {
      id: 'vibe-friends-coastal-scenery',
      unsplashId: 'photo-1529156069898-49953e39b3ac',
      scene: 'five friends sitting shoulder to shoulder overlooking coastal scenery',
      activities: ['social', 'friendship', 'city', 'weekend', 'explore', 'events']
    },
    {
      id: 'vibe-friends-laughing-golden',
      unsplashId: 'photo-1511988617509-a57c8a288659',
      scene: 'friends laughing and dancing together outdoors at golden hour',
      activities: ['social', 'events', 'festival', 'friendship', 'music']
    },
    {
      id: 'vibe-friends-street-chat',
      unsplashId: 'photo-1543807535-eceef0bc6599',
      scene: 'friends laughing and chatting casually on sunny city street',
      activities: ['social', 'city', 'friendship', 'explore', 'local']
    },
    {
      id: 'vibe-outdoor-hilltop-friends',
      unsplashId: 'photo-1506869640319-fe1a24fd76dc',
      scene: 'group of friends hiking together on scenic hilltop at sunset',
      activities: ['hiking', 'outdoors', 'nature', 'social', 'weekend']
    },
    {
      id: 'vibe-friends-park-social',
      unsplashId: 'photo-1517486808906-6ca8b3f04846',
      scene: 'group of friends smiling and socializing together outdoors',
      activities: ['social', 'park', 'friendship', 'meetup']
    }
  ],
  DATE: [
    {
      id: 'date-couple-candid-outdoors',
      unsplashId: 'photo-1663579167845-c73285e3805b',
      scene: 'candid adult couple smiling closely together outdoors in outdoor jackets',
      activities: ['dating', 'outdoor', 'chemistry', 'lifestyle', 'romantic', 'active']
    },
    {
      id: 'date-couple-laughing-close',
      unsplashId: 'photo-1746813629190-80f67d5050fa',
      scene: 'happy attractive couple laughing together in romantic close embrace',
      activities: ['dating', 'romantic', 'chemistry', 'laughter']
    },
    {
      id: 'date-couple-walking-holding-hands',
      unsplashId: 'photo-1473867832923-830c92cece07',
      scene: 'couple holding hands walking together on romantic outdoor stroll',
      activities: ['dating', 'walk', 'outdoor', 'romantic', 'lifestyle', 'active']
    },
    {
      id: 'date-couple-cafe-social',
      unsplashId: 'photo-1525610553991-2bede1a236e2',
      scene: 'adults socializing at modern coffee shop counter with barista and espresso cups',
      activities: ['dating', 'coffee', 'cafe', 'romantic', 'intimate']
    },
    {
      id: 'date-cocktails-cheers-date',
      unsplashId: 'photo-1617524455617-ce1e266aa810',
      scene: 'craft cocktails cheering on romantic evening date in atmospheric bar',
      activities: ['dating', 'drinks', 'cocktails', 'nightlife', 'bar', 'evening']
    },
    {
      id: 'date-wine-celebration-toast',
      unsplashId: 'photo-1519671482749-fd09be7ccebf',
      scene: 'warm evening toast with wine glasses in romantic celebration atmosphere',
      activities: ['dating', 'drinks', 'celebration', 'evening', 'romantic']
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

  const textToCheck = `${photo?.scene || ''} ${(photo?.activities || []).join(' ')}`.toLowerCase();
  for (const prohibited of PROHIBITED_VIBE_KEYWORDS) {
    if (photo?.mode === 'VIBE' || photo?.id?.startsWith('vibe-')) {
      if (textToCheck.includes(prohibited)) {
        issues.push(`prohibited_vibe_keyword:${prohibited}`);
      }
    }
  }
  return issues;
}
