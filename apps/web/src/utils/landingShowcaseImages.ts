import { landingShowcaseDebugEnabled, logLandingShowcase } from '@/utils/landingShowcaseDebug';
import { NO_PHOTO_PLACEHOLDER } from '@/utils/profilePhotos';

/**
 * Public landing-showcase JSON is server-curated (presigned S3, CDN, or seeded dummy Unsplash).
 * Do not second-guess URLs here — stripping stock previously hid real CRM dummy seeds and broke the deck.
 */
export function pickLandingShowcasePhotoUrl(apiUrl: string | undefined | null): string {
  const u = (apiUrl || '').trim();
  if (u) return u;
  if (landingShowcaseDebugEnabled()) {
    logLandingShowcase('pickLandingShowcasePhotoUrl → NO_PHOTO', { reason: 'empty' });
  }
  return NO_PHOTO_PLACEHOLDER;
}

/**
 * Extra props for landing hero / deck images.
 * Avoid `referrerPolicy: no-referrer`: buckets that allow GetObject only for your site's Referer
 * will 403 presigned URLs when the browser sends no Referer.
 */
export function landingShowcaseImageProps(_url: string): Record<string, never> {
  return {};
}
