const EXTERNAL_OR_INLINE_URL = /^(https?:)?\/\/|^(data|blob):/i;

/**
 * Converts a local repo public asset path into the URL browsers can load after deploy.
 * Example: C:\Apps\GetTrainMate\apps\web\public\images\event-banner.png -> /images/event-banner.png
 */
export function normalizePublicAssetUrl(value?: string | null): string {
  const raw = value?.trim();
  if (!raw) return '';
  if (EXTERNAL_OR_INLINE_URL.test(raw)) return raw;

  const normalizedSlashes = raw.replace(/\\/g, '/');
  const lower = normalizedSlashes.toLowerCase();
  const publicMarker = '/public/';
  const publicIndex = lower.lastIndexOf(publicMarker);

  if (publicIndex >= 0) {
    return `/${normalizedSlashes.slice(publicIndex + publicMarker.length).replace(/^\/+/, '')}`;
  }

  if (lower.startsWith('public/')) {
    return `/${normalizedSlashes.slice('public/'.length).replace(/^\/+/, '')}`;
  }

  if (lower.startsWith('images/')) {
    return `/${normalizedSlashes}`;
  }

  return normalizedSlashes;
}
