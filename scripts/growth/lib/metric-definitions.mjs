/**
 * Canonical GetTrainMate growth metric definitions.
 * Shared by snapshot collection and Admin email. Never invent values.
 *
 * Alias rule: when multiple event names instrument the SAME user action,
 * pick ONE primary. Do NOT sum aliases (that double-counts).
 * Fallbacks are used only when the primary is absent (eventCount === 0).
 */

/** Events requested from GA4 Data API (deduped). */
export const GA4_FUNNEL_EVENT_NAMES = [
  'landing_page_view',
  'signup_started',
  'signup_completed',
  'sign_up',
  'profile_started',
  'profile_completed',
  'onboarding_started',
  'onboarding_completed',
  'mode_selected',
  'location_completed',
  'discover_started',
  'discover_viewed',
  'match_search_clicked',
  'find_my_matches_clicked',
  'profile_viewed',
  'request_sent',
  'like_or_connection_sent',
  'match_created',
  'match_shown',
  'first_message_sent',
  'chat_started',
  'message_cta_clicked',
  'meaningful_conversation',
  'return_visit',
  'pricing_viewed',
  'view_pricing',
  'begin_checkout',
  'checkout_started',
  'purchase',
  'login',
  'session_start',
  'page_view'
];

/**
 * Canonical metric → resolution strategy.
 * - primary: preferred GA4 event name
 * - fallbacks: used only if primary eventCount is 0
 * - kind: 'events' | 'users' — how the value should be labeled in reports
 * - preferUsers: when true and totalUsers available for chosen event, use totalUsers
 */
export const CANONICAL_METRICS = {
  landings: {
    primary: 'landing_page_view',
    fallbacks: [],
    kind: 'events',
    preferUsers: false,
    notes: 'Count of landing_page_view only. page_view is NOT an alias (SPA noise).'
  },
  completed_signups: {
    primary: 'signup_completed',
    fallbacks: ['sign_up'],
    kind: 'users',
    preferUsers: true,
    notes: 'signup_completed is canonical; sign_up is GA4 recommended duplicate — do not sum.'
  },
  completed_profiles: {
    primary: 'profile_completed',
    fallbacks: ['onboarding_completed'],
    kind: 'users',
    preferUsers: true,
    notes: 'profile_completed preferred; onboarding_completed only if profile_completed absent.'
  },
  discover_users: {
    primary: 'discover_started',
    fallbacks: ['discover_viewed'],
    kind: 'users',
    preferUsers: true,
    notes: 'Do not include match_search_clicked (CTA click, not Discover session).'
  },
  connections_sent: {
    primary: 'request_sent',
    fallbacks: ['like_or_connection_sent'],
    kind: 'events',
    preferUsers: false,
    notes: 'Connection/request actions as event counts.'
  },
  matches_created: {
    primary: 'match_created',
    fallbacks: [],
    kind: 'events',
    preferUsers: false,
    notes: 'match_shown is NOT match_created — never alias.'
  },
  first_messages: {
    primary: 'first_message_sent',
    fallbacks: [],
    kind: 'events',
    preferUsers: false,
    notes: 'chat_started is not first_message_sent — never alias.'
  },
  returning_users: {
    primary: 'return_visit',
    fallbacks: [],
    kind: 'users',
    preferUsers: true,
    notes: 'Prefer totalUsers for return_visit; raw event count is not unique users.'
  },
  pricing_views: {
    primary: 'pricing_viewed',
    fallbacks: ['view_pricing'],
    kind: 'events',
    preferUsers: false,
    notes: 'pricing_viewed preferred; view_pricing only if pricing_viewed absent.'
  },
  checkout_starts: {
    primary: 'begin_checkout',
    fallbacks: ['checkout_started'],
    kind: 'events',
    preferUsers: false,
    notes: 'begin_checkout is GA4 recommended; checkout_started is custom alias — do not sum.'
  },
  signup_starts: {
    primary: 'signup_started',
    fallbacks: [],
    kind: 'events',
    preferUsers: false,
    notes: 'Signup form starts.'
  },
  verified_purchase_events: {
    primary: 'purchase',
    fallbacks: [],
    kind: 'events',
    preferUsers: false,
    notes: 'GA4 purchase events (directional). Stripe live payments are revenue source of truth.'
  }
};

export const EXP001 = {
  id: 'EXP-001',
  path: '/atlanta-training-partners',
  srcParam: 'atlanta-training-partners',
  evaluationDate: '2026-08-16'
};

export const SITE = {
  origin: 'https://gettrainmate.com',
  admin: 'https://gettrainmate.com/admin',
  atlanta: 'https://gettrainmate.com/atlanta-training-partners',
  repo: 'https://github.com/maxkantor/GetTrainMate',
  experimentLogPath: 'docs/growth/EXPERIMENT-LOG.md',
  amplifyAppId: 'd3tocp1533tn5q'
};

export const TIMEZONE = 'America/New_York';
