/**
 * Curated real photography (Unsplash) — free to hotlink, no API key, no AI generation cost.
 * Portrait-friendly fitness / social / dating lifestyle scenes.
 */
export const STOCK_PHOTOS = {
  TRAIN: [
    { id: 'train-gym-partner-1', unsplashId: 'photo-1571019614242-c5c5dee9f50b', scene: 'gym training' },
    { id: 'train-gym-weights-2', unsplashId: 'photo-1517836357463-d25dfeac3438', scene: 'gym weights' },
    { id: 'train-gym-studio-3', unsplashId: 'photo-1534438327276-14e5300c3a48', scene: 'gym studio' },
    { id: 'train-running-trail-4', unsplashId: 'photo-1434682881778-8b87f5f6f4db', scene: 'outdoor running' },
    { id: 'train-hiit-class-5', unsplashId: 'photo-1518611012118-43ce6c88c9b9', scene: 'group fitness' },
    { id: 'train-yoga-pair-6', unsplashId: 'photo-1526403220312-7f4b7716615a', scene: 'yoga stretch' },
    { id: 'train-couple-run-7', unsplashId: 'photo-1576678927484-cc907957088a', scene: 'couple fitness' },
    { id: 'train-outdoor-8', unsplashId: 'photo-1544367567-0f2fcb009e0b', scene: 'outdoor workout' },
    { id: 'train-swim-9', unsplashId: 'photo-1530549387789-4c101f663662', scene: 'swim training' },
    { id: 'train-pickleball-10', unsplashId: 'photo-1622163642998-27549003c62e', scene: 'court sport' },
    { id: 'train-row-11', unsplashId: 'photo-1544551763-46a013bb70d5', scene: 'rowing workout' },
    { id: 'train-cycle-12', unsplashId: 'photo-1574629810360-7efbbe195018', scene: 'cycling' }
  ],
  VIBE: [
    { id: 'vibe-friends-1', unsplashId: 'photo-1529156069898-49953e39b3ac', scene: 'friends together' },
    { id: 'vibe-city-walk-2', unsplashId: 'photo-1488646953014-85cb44e25828', scene: 'city explore' },
    { id: 'vibe-rooftop-3', unsplashId: 'photo-1470225620780-dba8ba36b745', scene: 'social rooftop' },
    { id: 'vibe-concert-4', unsplashId: 'photo-1506157786151-b8491531c063', scene: 'live music' },
    { id: 'vibe-brunch-5', unsplashId: 'photo-1414235077428-338989a2e8c0', scene: 'brunch friends' },
    { id: 'vibe-park-6', unsplashId: 'photo-1522771739844-6a9f6d5f14af', scene: 'park hangout' },
    { id: 'vibe-travel-7', unsplashId: 'photo-1469850723596-aa0b873bb178', scene: 'weekend trip' },
    { id: 'vibe-beach-8', unsplashId: 'photo-1507525428034-b723cf961ba3', scene: 'beach boardwalk' },
    { id: 'vibe-festival-9', unsplashId: 'photo-1459745459410-8796b68d7018', scene: 'outdoor event' },
    { id: 'vibe-cafe-10', unsplashId: 'photo-1495474472287-4d71bcdd2085', scene: 'cafe meetup' }
  ],
  DATE: [
    { id: 'date-coffee-1', unsplashId: 'photo-1522673607200-8364bf909237', scene: 'coffee date' },
    { id: 'date-walk-2', unsplashId: 'photo-1516589178581-6cd7833ae3b2', scene: 'couple walking' },
    { id: 'date-sunset-3', unsplashId: 'photo-1518199265581-2651517e9342', scene: 'sunset together' },
    { id: 'date-picnic-4', unsplashId: 'photo-1529333166438-27550a167fe1', scene: 'outdoor date' },
    { id: 'date-city-5', unsplashId: 'photo-1524504388940-b1c1722653e1', scene: 'city date night' },
    { id: 'date-hike-6', unsplashId: 'photo-1506905925346-21bda4d32df4', scene: 'mountain date' },
    { id: 'date-dinner-7', unsplashId: 'photo-1559339352-11d035aa65de', scene: 'dinner date' },
    { id: 'date-beach-8', unsplashId: 'photo-1502680390469-be75c86b636f', scene: 'beach stroll' },
    { id: 'date-smoothie-9', unsplashId: 'photo-1493770348161-369653aebbd2', scene: 'smoothie date' },
    { id: 'date-rooftop-10', unsplashId: 'photo-1514933651103-005eec06c04b', scene: 'rooftop date' }
  ]
};

export function unsplashCropUrl(unsplashId, { width = 1080, height = 1350 } = {}) {
  const id = String(unsplashId || '').replace(/^photo-/, 'photo-');
  return `https://images.unsplash.com/${id}?w=${width}&h=${height}&fit=crop&q=85&auto=format`;
}

export function stockPhotosForMode(mode) {
  return STOCK_PHOTOS[String(mode || 'TRAIN').toUpperCase()] || STOCK_PHOTOS.TRAIN;
}
