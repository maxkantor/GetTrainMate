/**
 * Market campaigns are first-class records, not a frozen worldwide list.
 * Candidates below are an initial portfolio; ranking and activation live in CRM.
 * Language (i18n locale) is independent of market/city.
 */

export const APP_MODES = ['TRAIN', 'VIBE', 'DATE'] as const;
export type AppMode = (typeof APP_MODES)[number];

export const APPROVED_OUTREACH_LANGUAGES = ['en'] as const;
export const PENDING_OUTREACH_LANGUAGES = ['es', 'ru'] as const;

export const MAX_ACTIVE_MARKETS = 3;

export type MarketCampaignStatus = 'active' | 'paused' | 'candidate';

export type MarketCampaign = {
  campaignId: string;
  country: string;
  market: string;
  displayName: string;
  languages: string[];
  primaryMode: AppMode;
  status: MarketCampaignStatus;
  timezone: string;
  targetOrgTypes: string[];
};

/** Initial candidates only. Do not treat this as the exclusive global market set. */
export const INITIAL_MARKET_CANDIDATES: MarketCampaign[] = [
  {
    campaignId: 'us_atlanta_train_partners',
    country: 'us',
    market: 'atlanta',
    displayName: 'Atlanta',
    languages: ['en'],
    primaryMode: 'TRAIN',
    status: 'active',
    timezone: 'America/New_York',
    targetOrgTypes: [
      'gym',
      'personal_trainer',
      'run_club',
      'pickleball',
      'crossfit_hyrox',
      'cycling',
      'hiking',
      'rec_sports',
      'fitness_event',
    ],
  },
  {
    campaignId: 'us_miami_train_partners',
    country: 'us',
    market: 'miami',
    displayName: 'Miami / Fort Lauderdale',
    languages: ['en', 'es'],
    primaryMode: 'TRAIN',
    status: 'candidate',
    timezone: 'America/New_York',
    targetOrgTypes: ['gym', 'run_club', 'pickleball', 'crossfit_hyrox', 'rec_sports'],
  },
  {
    campaignId: 'us_new_york_train_partners',
    country: 'us',
    market: 'new-york',
    displayName: 'New York City',
    languages: ['en', 'es', 'ru'],
    primaryMode: 'TRAIN',
    status: 'candidate',
    timezone: 'America/New_York',
    targetOrgTypes: ['gym', 'run_club', 'crossfit_hyrox', 'cycling', 'rec_sports'],
  },
  {
    campaignId: 'gb_london_train_partners',
    country: 'gb',
    market: 'london',
    displayName: 'London',
    languages: ['en'],
    primaryMode: 'TRAIN',
    status: 'candidate',
    timezone: 'Europe/London',
    targetOrgTypes: ['gym', 'run_club', 'cycling', 'rec_sports'],
  },
  {
    campaignId: 'ca_toronto_train_partners',
    country: 'ca',
    market: 'toronto',
    displayName: 'Toronto',
    languages: ['en'],
    primaryMode: 'TRAIN',
    status: 'candidate',
    timezone: 'America/Toronto',
    targetOrgTypes: ['gym', 'run_club', 'crossfit_hyrox', 'rec_sports'],
  },
];

export function slugPart(raw: string | undefined | null): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function utmCampaignId(country: string, market: string, mode: string): string {
  return `${slugPart(country)}_${slugPart(market)}_${String(mode || 'TRAIN').toLowerCase()}_partners`;
}

export function partnerHubPath(country: string, market: string): string {
  return `/partners/${slugPart(country)}/${slugPart(market)}`;
}

export function partnerInvitePath(country: string, market: string, inviteCode: string): string {
  return `${partnerHubPath(country, market)}/${slugPart(inviteCode)}`;
}

/** Legacy EXP-002 Atlanta paths stay valid via alias. */
export function legacyAtlantaInvitePath(inviteCode: string): string {
  return `/partners/atlanta/${slugPart(inviteCode)}`;
}

export function canonicalAtlantaInvitePath(inviteCode: string): string {
  return partnerInvitePath('us', 'atlanta', inviteCode);
}

export function partnerOutreachQuery(opts: {
  country: string;
  market: string;
  mode?: string;
  inviteCode: string;
  experimentId?: string;
  orgType?: string;
}): string {
  const mode = (opts.mode || 'TRAIN').toUpperCase();
  const campaign = utmCampaignId(opts.country, opts.market, mode);
  const params = new URLSearchParams({
    metro: opts.market,
    country: slugPart(opts.country),
    mode,
    src: 'partner',
    partner: slugPart(opts.inviteCode),
    experiment_id: opts.experimentId || (slugPart(opts.market) === 'atlanta' ? 'EXP-002' : campaign),
    utm_source: 'partner_outreach',
    utm_medium: 'email',
    utm_campaign: campaign,
  });
  if (opts.orgType) params.set('utm_content', slugPart(opts.orgType));
  return params.toString();
}

export function partnerSignupPath(opts: {
  country: string;
  market: string;
  mode?: string;
  inviteCode: string;
  experimentId?: string;
  orgType?: string;
}): string {
  return `/signup?${partnerOutreachQuery(opts)}`;
}

export function isApprovedOutreachLanguage(lang: string | undefined | null): boolean {
  return APPROVED_OUTREACH_LANGUAGES.includes(String(lang || '').toLowerCase() as (typeof APPROVED_OUTREACH_LANGUAGES)[number]);
}

export function canActivateAnotherMarket(activeCount: number, max = MAX_ACTIVE_MARKETS): boolean {
  return activeCount < max;
}

/** Initial allocation guidance: 50% / 30% / 20% of effort across at most 3 active markets. */
export function recommendedAllocations(rankedActiveCampaignIds: string[]): Record<string, number> {
  const percents = [50, 30, 20];
  const out: Record<string, number> = {};
  rankedActiveCampaignIds.slice(0, MAX_ACTIVE_MARKETS).forEach((id, i) => {
    out[id] = percents[i] ?? 0;
  });
  return out;
}

export function normalizeInviteCode(raw: string | undefined | null): string | null {
  const cleaned = slugPart(raw);
  return cleaned || null;
}

export type MarketEvidence = {
  campaignId: string;
  registeredUsers?: number | null;
  completedProfiles?: number | null;
  discoverUsers?: number | null;
  connections?: number | null;
  matches?: number | null;
  firstMessages?: number | null;
  landingSessions?: number | null;
  languageSupported?: boolean;
  publicPartnerAvailability?: number | null;
};

/** Rank by verified evidence only. Missing metrics sort last, never guessed. */
export function rankMarkets(rows: MarketEvidence[]): MarketEvidence[] {
  const score = (r: MarketEvidence) =>
    (r.completedProfiles ?? 0) * 8 +
    (r.discoverUsers ?? 0) * 6 +
    (r.connections ?? 0) * 5 +
    (r.matches ?? 0) * 10 +
    (r.firstMessages ?? 0) * 7 +
    (r.landingSessions ?? 0) +
    (r.registeredUsers ?? 0) +
    (r.publicPartnerAvailability ?? 0) +
    (r.languageSupported ? 2 : 0);
  return [...rows].sort((a, b) => score(b) - score(a));
}
