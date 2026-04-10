/**
 * Photo and video upload limits by subscription tier (credits as proxy for purchased packs).
 * Free / starter: 1 photo. Go (10+ cr): 3 photos. Best Value+ (30+ cr): 10 photos. Power/Elite (80+ cr): 10 photos + video.
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
 */
export function getUploadLimits(credits: number, plan?: string): UploadLimits {
  if (plan === 'elite' || plan === 'premium' || credits >= 80) {
    return { maxPhotos: 10, maxVideoSeconds: 30 };
  }
  if (plan === 'pro' || credits >= 30) {
    return { maxPhotos: 10, maxVideoSeconds: 0 };
  }
  if (credits >= 10) {
    return { maxPhotos: 3, maxVideoSeconds: 0 };
  }
  return DEFAULT_LIMITS;
}
