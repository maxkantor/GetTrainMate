/**
 * Human-reviewed owned-social catalog metadata + conversion caption resolution.
 * Captions/headlines/CTAs are selected from locale-aware social-copy-variants.
 * Never promises matches, dates, or outcomes.
 */
import { selectCopyPackage } from './social-copy-variants.mjs';

export const OWNED_ACCOUNTS = {
  facebook: {
    network: 'facebook',
    url: 'https://www.facebook.com/gettrainmate',
    handle: 'gettrainmate'
  },
  instagram: {
    network: 'instagram',
    url: 'https://www.instagram.com/gettrainmate/',
    handle: '@gettrainmate'
  }
};

export const MODE_LANDINGS = {
  TRAIN: '/workout-partner',
  VIBE: '/meet-people',
  DATE: '/active-dating'
};

const IMAGE = 'https://gettrainmate.com/images/og-image.jpg';

/** Day of week (America/New_York, 0=Sun, 6=Sat) → balanced TRAIN / VIBE / DATE rotation. */
export function modeForWeekday(weekday) {
  // Mon (1), Thu (4) -> TRAIN
  // Tue (2), Fri (5) -> VIBE
  // Wed (3), Sat (6) -> DATE
  // Sun (0) -> VIBE (community & plans before the week begins)
  if (weekday === 1 || weekday === 4) return 'TRAIN';
  if (weekday === 2 || weekday === 5 || weekday === 0) return 'VIBE';
  if (weekday === 3 || weekday === 6) return 'DATE';
  return 'TRAIN';
}

export function languageForWeekday(weekday, isoDate = '') {
  const week = isoWeekNumber(isoDate);
  const langs = ['en', 'es', 'ru'];
  if (weekday === 1 || weekday === 4) return langs[week % 3];
  if (weekday === 2 || weekday === 5 || weekday === 0) return langs[(week + 1) % 3];
  if (weekday === 3 || weekday === 6) return langs[(week + 2) % 3];
  return langs[week % 3];
}

function hashSeed(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** ISO week number from YYYY-MM-DD for language/content rotation. */
export function isoWeekNumber(isoDate = '') {
  const raw = String(isoDate || '').slice(0, 10);
  const d = raw.match(/^\d{4}-\d{2}-\d{2}$/) ? new Date(`${raw}T12:00:00Z`) : new Date();
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

/**
 * Catalog entries are campaign/locale anchors. Caption + image text are resolved
 * at publish time via resolveOwnedSocialCreative (conversion copy rotation).
 * Optional facebook/instagram strings are legacy fallbacks only.
 */
export const CATALOG = [
  {
    contentId: 'train-en-workout-partner',
    mode: 'TRAIN',
    language: 'en',
    kind: 'acquisition',
    activity: 'workout',
    landingPath: MODE_LANDINGS.TRAIN,
    imageUrl: IMAGE
  },
  {
    contentId: 'train-es-socio-entrenamiento',
    mode: 'TRAIN',
    language: 'es',
    kind: 'acquisition',
    activity: 'gym',
    landingPath: MODE_LANDINGS.TRAIN,
    imageUrl: IMAGE
  },
  {
    contentId: 'train-ru-trenirovochniy-partner',
    mode: 'TRAIN',
    language: 'ru',
    kind: 'acquisition',
    activity: 'running',
    landingPath: MODE_LANDINGS.TRAIN,
    imageUrl: IMAGE
  },
  {
    contentId: 'vibe-en-new-in-town',
    mode: 'VIBE',
    language: 'en',
    kind: 'community',
    activity: 'events',
    landingPath: MODE_LANDINGS.VIBE,
    imageUrl: IMAGE
  },
  {
    contentId: 'vibe-es-planes-ciudad',
    mode: 'VIBE',
    language: 'es',
    kind: 'community',
    activity: 'social',
    landingPath: MODE_LANDINGS.VIBE,
    imageUrl: IMAGE
  },
  {
    contentId: 'vibe-ru-kompaniya-v-gorode',
    mode: 'VIBE',
    language: 'ru',
    kind: 'community',
    activity: 'friendship',
    landingPath: MODE_LANDINGS.VIBE,
    imageUrl: IMAGE
  },
  {
    contentId: 'date-en-active-singles',
    mode: 'DATE',
    language: 'en',
    kind: 'acquisition',
    activity: 'dating',
    landingPath: MODE_LANDINGS.DATE,
    imageUrl: IMAGE
  },
  {
    contentId: 'date-en-sf-bay',
    mode: 'DATE',
    language: 'en',
    market: 'San Francisco',
    kind: 'acquisition',
    activity: 'dating',
    landingPath: '/san-francisco',
    imageUrl: IMAGE,
    marketHook: 'Bay Area:'
  },
  {
    contentId: 'date-es-citas-actividad',
    mode: 'DATE',
    language: 'es',
    kind: 'acquisition',
    activity: 'dating',
    landingPath: MODE_LANDINGS.DATE,
    imageUrl: IMAGE
  },
  {
    contentId: 'date-ru-po-interesam',
    mode: 'DATE',
    language: 'ru',
    kind: 'acquisition',
    activity: 'dating',
    landingPath: MODE_LANDINGS.DATE,
    imageUrl: IMAGE
  },
  {
    contentId: 'train-en-question-consistency',
    mode: 'TRAIN',
    language: 'en',
    kind: 'question',
    activity: 'accountability',
    landingPath: MODE_LANDINGS.TRAIN,
    imageUrl: IMAGE
  }
];

function withMarketHook(body, marketHook) {
  if (!marketHook || !body) return body;
  const lines = String(body).split('\n');
  if (!lines[0]) return body;
  lines[0] = `${marketHook} ${lines[0]}`;
  return lines.join('\n');
}

/**
 * Resolve conversion copy for a catalog item so image + caption share one locale.
 */
export function resolveOwnedSocialCreative(catalogItem, { isoDate = '', recentEntries = [] } = {}) {
  const item = catalogItem || CATALOG[0];
  const copyPackage = selectCopyPackage({
    mode: item.mode,
    language: item.language,
    isoDate,
    contentId: item.contentId,
    recentEntries
  });
  let facebook = copyPackage.facebook;
  let instagram = copyPackage.instagram;
  if (item.marketHook) {
    facebook = withMarketHook(facebook, item.marketHook);
    instagram = withMarketHook(instagram, item.marketHook);
  }
  return {
    ...item,
    facebook,
    instagram,
    imageHeadline: copyPackage.headline,
    imageSubheadline: copyPackage.subheadline,
    imageCta: copyPackage.cta,
    copyPackage,
    copy_variant: copyPackage.copyVariant,
    headline_variant: copyPackage.headlineVariant,
    cta_variant: copyPackage.ctaVariant,
    locale: copyPackage.locale,
    campaign: copyPackage.campaign
  };
}
export function goCodeForDestination({ mode, landingPath } = {}) {
  const path = String(landingPath || '').replace(/\/$/, '') || '';
  if (path === '/san-francisco') return 'sf';
  if (path === '/meet-people' || String(mode).toUpperCase() === 'VIBE') return 'v';
  if (path === '/active-dating' || String(mode).toUpperCase() === 'DATE') return 'd';
  return 't';
}

/**
 * Click destination for organic posts. Mode landings convert 0 signups after 7 lock days —
 * send TRAIN/VIBE/DATE traffic to /signup with mode already in the query. SF density landing
 * stays on /san-francisco (EXP-004).
 */
export function ownedSocialClickPath({ mode, landingPath } = {}) {
  const path = String(landingPath || '').replace(/\/$/, '');
  if (path === '/san-francisco') return '/san-francisco';
  if (path === '/signup') return '/signup';
  return '/signup';
}

/**
 * Full tracked URL (used for Facebook `link` attachment — clickable image/card).
 * Preserves existing UTMs; adds copy analytics params when provided.
 */
export function trackedUrl({
  network,
  mode,
  language,
  contentId,
  landingPath,
  isoDate,
  market,
  copyVariant,
  headlineVariant,
  ctaVariant,
  campaign: campaignOverride
} = {}) {
  const path = ownedSocialClickPath({ mode, landingPath });
  const marketSlug = market ? String(market).toLowerCase().replace(/\s+/g, '-') : '';
  const campaign =
    campaignOverride ||
    (marketSlug
      ? `owned-${network}-${String(mode).toLowerCase()}-${language}-${marketSlug}-${isoDate}`
      : `owned-${network}-${String(mode).toLowerCase()}-${language}-${isoDate}`);
  const contentParts = [contentId, copyVariant, headlineVariant, ctaVariant].filter(Boolean);
  const params = new URLSearchParams({
    utm_source: network,
    utm_medium: 'organic',
    utm_campaign: campaign,
    utm_content: contentParts.join('__'),
    mode,
    lang: language,
    src: 'owned_social'
  });
  if (market) params.set('metro', String(market));
  if (copyVariant) params.set('copy_variant', String(copyVariant));
  if (headlineVariant) params.set('headline_variant', String(headlineVariant));
  if (ctaVariant) params.set('cta_variant', String(ctaVariant));
  return `https://gettrainmate.com${path}?${params.toString()}`;
}

/**
 * Short branded URL for Instagram captions (IG cannot attach links to images via Graph API).
 * Example: https://gettrainmate.com/go/t?utm_source=instagram&...
 * Resolves via SPA /go/:code → real landing while preserving UTMs.
 */
export function shortTrackedUrl(opts) {
  const code = goCodeForDestination(opts);
  const full = new URL(trackedUrl(opts));
  return `https://gettrainmate.com/go/${code}?${full.searchParams.toString()}`;
}

/** Permanent bio / hub URL — set Instagram website to this once. */
export const OWNED_SOCIAL_BIO_URL = 'https://gettrainmate.com/go';

export function renderCopy(template, url) {
  return String(template || '').replaceAll('{{url}}', url);
}

const BIO_LINK_LINES = {
  en: 'Link also in bio → gettrainmate.com/go',
  es: 'Enlace también en la bio → gettrainmate.com/go',
  ru: 'Ссылка также в профиле → gettrainmate.com/go'
};

/** Facebook caption: prefer short URL; link attachment carries the real click target. */
export function renderFacebookCopy(template, shortUrl) {
  const body = String(template || '').replaceAll('{{url}}', shortUrl || '').trim();
  return body;
}

/** Instagram caption: short URL on its own line + localized bio fallback. */
export function renderInstagramCopy(template, shortUrl, { language = 'en' } = {}) {
  const locale = String(language || 'en').toLowerCase().slice(0, 2);
  const body = String(template || '')
    .replaceAll('{{url}}', '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const linkBlock = [shortUrl || OWNED_SOCIAL_BIO_URL, '', BIO_LINK_LINES[locale] || BIO_LINK_LINES.en].join('\n');
  return `${body}\n\n${linkBlock}`;
}

/**
 * Pick the next catalog item for a weekday, skipping recently used contentIds.
 * Always prefers the campaign locale — never mix languages for one creative.
 */
export function selectCatalogItem({
  weekday,
  recentlyUsedIds = [],
  preferMode,
  preferLanguage,
  isoDate = ''
} = {}) {
  const mode = preferMode || modeForWeekday(weekday ?? 1);
  const language = preferLanguage || languageForWeekday(weekday ?? 1, isoDate);
  const used = new Set(recentlyUsedIds);
  const pool = CATALOG.filter((c) => c.mode === mode);
  let candidates = pool.filter((c) => c.language === language && !used.has(c.contentId));
  if (!candidates.length) candidates = pool.filter((c) => c.language === language);
  // Last resort only: same mode, other locales (should be rare with 1+ item per locale).
  if (!candidates.length) candidates = pool.filter((c) => !used.has(c.contentId));
  if (!candidates.length) candidates = pool.slice();
  candidates.sort((a, b) => a.contentId.localeCompare(b.contentId));
  const seed = hashSeed(`${isoDate}:${weekday}:${mode}:${language}`);
  return candidates[seed % candidates.length] || CATALOG[0];
}

export function findCatalogItemByContentId(contentId) {
  return CATALOG.find((c) => c.contentId === contentId) || null;
}

export function easternWeekday(date = new Date()) {
  const wd = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short'
  }).format(date);
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[wd] ?? date.getUTCDay();
}

export function easternIsoDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}

/**
 * Checks whether an owned social post was already published to Meta today (EST).
 * Protects against accidental multiple posts from automated task retries or backup schedules.
 */
export function alreadyPublishedToday(log = [], isoDate = easternIsoDate()) {
  if (!Array.isArray(log) || !log.length) return false;
  return log.some((entry) => {
    if (entry.status !== 'published') return false;
    if (!entry.facebookPostId && !entry.instagramPostId) return false;
    const entryDate = entry.publishedAtUtc
      ? easternIsoDate(new Date(entry.publishedAtUtc))
      : '';
    const campaignMatch = typeof entry.campaign === 'string' && entry.campaign.includes(isoDate);
    return entryDate === isoDate || campaignMatch;
  });
}

