/**
 * Production site origin — canonical host for SEO, OG URLs, sitemap, and JSON-LD.
 * Set VITE_PUBLIC_SITE_URL in Amplify / env (no trailing slash), e.g. https://gettrainmate.com
 */
export const SITE_ORIGIN = (
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_PUBLIC_SITE_URL
    ? String(import.meta.env.VITE_PUBLIC_SITE_URL).trim().replace(/\/$/, '')
    : 'https://gettrainmate.com'
);

/** OG / Twitter default image path (1200x630 JPG kept lightweight for chat link previews). */
export const OG_IMAGE_PATH = '/images/og-image.jpg?v=2';

export function absoluteUrl(pathname: string): string {
  const p = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (p === '/' || p === '') return `${SITE_ORIGIN}/`;
  return `${SITE_ORIGIN}${p.replace(/\/$/, '')}`;
}

export function ogImageAbsoluteUrl(): string {
  return `${SITE_ORIGIN}${OG_IMAGE_PATH}`;
}
