/**
 * Photo and video upload limits by subscription tier.
 * Free: 1 image. $3.99: 3 images. $7.99: 10 images. $19.99: 10 images + intro video.
 */

export interface UploadLimits {
  maxPhotos: number;
  maxVideoSeconds: number; // 0 = no video allowed
}

/** Default (free) limits */
export const DEFAULT_LIMITS: UploadLimits = {
  maxPhotos: 1,
  maxVideoSeconds: 0,
};

/**
 * Get upload limits based on user's credits (as proxy for purchased pack).
 * FREE_3 / no purchase: 1 photo
 * PACK_10 ($3.99): 3 photos
 * PACK_25 ($7.99): 10 photos
 * PACK_100 ($19.99): 10 photos + 30s video
 */
export function getUploadLimits(credits: number, plan?: string): UploadLimits {
  if (plan === 'elite' || plan === 'premium' || credits >= 100) {
    return { maxPhotos: 10, maxVideoSeconds: 30 };
  }
  if (plan === 'pro' || credits >= 25) {
    return { maxPhotos: 10, maxVideoSeconds: 0 };
  }
  if (credits >= 10) {
    return { maxPhotos: 3, maxVideoSeconds: 0 };
  }
  return DEFAULT_LIMITS;
}
