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

/** Props for landing hero / deck photos so S3 presigned URLs load reliably in the browser. */
export function landingShowcaseImageProps(url: string): { referrerPolicy?: 'no-referrer' } {
  const u = (url || '').trim();
  if (!u || u.startsWith('data:')) return {};
  if (/^https?:\/\//i.test(u)) return { referrerPolicy: 'no-referrer' };
  return {};
}
