import { landingShowcaseDebugEnabled, logLandingShowcase, redactUrlForLog } from '@/utils/landingShowcaseDebug';
import { NO_PHOTO_PLACEHOLDER } from '@/utils/profilePhotos';

/** Never show seed / stock URLs in marketing — they are not the CRM S3 uploads. */
export function isLandingStockOrPlaceholderPhotoUrl(url: string | undefined | null): boolean {
  const u = (url || '').trim();
  if (!u) return true;
  return /images\.unsplash\.com|picsum\.photo|randomuser\.me/i.test(u);
}

/** Prefer API presigned S3; if missing or stock, neutral placeholder (never Unsplash). */
export function pickLandingShowcasePhotoUrl(apiUrl: string | undefined | null): string {
  const u = (apiUrl || '').trim();
  if (u && !isLandingStockOrPlaceholderPhotoUrl(u)) return u;
  if (landingShowcaseDebugEnabled()) {
    logLandingShowcase('pickLandingShowcasePhotoUrl → NO_PHOTO', {
      hadUrl: Boolean(u),
      url: redactUrlForLog(u || undefined),
      reason: !u ? 'empty' : 'stock_or_blocked_host',
    });
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
