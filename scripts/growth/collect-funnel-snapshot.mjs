#!/usr/bin/env node
/**
 * Collect 7d + 30d funnel/revenue snapshot for GetTrainMate growth experiments.
 * Never prints secret values. Missing sources are reported, not invented.
 *
 * Env (or load from SSM first via load-ssm-secrets-into-env.mjs):
 *   GA4_PROPERTY_ID
 *   GOOGLE_ANALYTICS_CREDENTIALS_JSON  (full service-account JSON string)
 *   STRIPE_RESTRICTED_READ_KEY         (rk_… read-only restricted key)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSsmSecretsIntoEnv } from './load-ssm-secrets-into-env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEASUREMENT_ID = 'G-C29M8NWNY4';

const FUNNEL_EVENTS = [
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
  'login'
];

const ssmLoad = loadSsmSecretsIntoEnv();
const outDir = path.join(__dirname, '../../docs/growth/snapshots');
const now = new Date();
const stamp = now.toISOString().slice(0, 10);

function daysAgo(n) {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

const windows = [
  { label: '7d', start: daysAgo(7), end: stamp },
  { label: '30d', start: daysAgo(30), end: stamp }
];

const report = {
  generatedAt: now.toISOString(),
  product: 'GetTrainMate',
  measurementId: MEASUREMENT_ID,
  ssm: ssmLoad,
  sources: { ga4: 'missing', stripe: 'missing', adminCrm: 'not_queried' },
  marketplaceDensity: {
    assumptionMetro: 'Atlanta, Georgia',
    assumptionNote:
      'Default focus metro until GA4/CRM data shows a clear leader. Validate on each growth run.',
    byMetro: null
  },
  windows: {},
  funnelSummary: {},
  notes: []
};

async function fetchGa4Report(propertyId, credentialsJson, startDate, endDate, body) {
  const creds = JSON.parse(credentialsJson);
  const { GoogleAuth } = await import('google-auth-library').catch(() => ({ GoogleAuth: null }));
  if (!GoogleAuth) {
    report.notes.push(
      'google-auth-library not installed; run: npm i --prefix scripts/growth'
    );
    return null;
  }
  const auth = new GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/analytics.readonly']
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    report.notes.push(`GA4 error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return null;
  }
  return res.json();
}

async function fetchGa4Events(propertyId, credentialsJson, startDate, endDate) {
  return fetchGa4Report(propertyId, credentialsJson, startDate, endDate, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'eventName' }, { name: 'sessionDefaultChannelGroup' }],
    metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        inListFilter: { values: FUNNEL_EVENTS }
      }
    }
  });
}

async function fetchGa4Metro(propertyId, credentialsJson, startDate, endDate) {
  const body = {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'customEvent:metro' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        inListFilter: { values: ['signup_completed', 'onboarding_completed', 'discover_viewed', 'return_visit'] }
      }
    }
  };
  const result = await fetchGa4Report(propertyId, credentialsJson, startDate, endDate, body);
  if (!result?.rows?.length) {
    report.notes.push(
      'Metro segmentation unavailable (customEvent:metro not populated in GA4). Use Admin CRM city aggregates when wired.'
    );
    return null;
  }
  const byMetro = {};
  for (const row of result.rows) {
    const metro = row.dimensionValues?.[0]?.value ?? 'unknown';
    if (metro === '(not set)' || metro === 'unknown') continue;
    byMetro[metro] = Number(row.metricValues?.[0]?.value ?? 0);
  }
  return Object.keys(byMetro).length ? byMetro : null;
}

async function fetchStripe(key, startUnix) {
  const params = new URLSearchParams({
    'created[gte]': String(startUnix),
    limit: '100',
    status: 'complete'
  });
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions?${params}`, {
    headers: { Authorization: `Bearer ${key}` }
  });
  if (!res.ok) {
    report.notes.push(`Stripe error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return null;
  }
  return res.json();
}

function summarizeStripe(sessions) {
  const live = (sessions?.data ?? []).filter((s) => s.livemode && s.payment_status === 'paid');
  const test = (sessions?.data ?? []).filter((s) => !s.livemode && s.payment_status === 'paid');
  const revenueLive = live.reduce((sum, s) => sum + (s.amount_total || 0), 0) / 100;
  const revenueTest = test.reduce((sum, s) => sum + (s.amount_total || 0), 0) / 100;
  return {
    livePaidSessions: live.length,
    testPaidSessions: test.length,
    revenueLiveUsd: revenueLive,
    revenueTestUsd: revenueTest
  };
}

function sumEventsByName(ga4) {
  const byEvent = {};
  for (const row of ga4?.rows ?? []) {
    const ev = row.dimensionValues?.[0]?.value ?? 'unknown';
    const count = Number(row.metricValues?.[0]?.value ?? 0);
    byEvent[ev] = (byEvent[ev] || 0) + count;
  }
  return byEvent;
}

function buildFunnelSummary(byEvent) {
  const get = (name, ...aliases) => {
    let total = byEvent[name] || 0;
    for (const a of aliases) total += byEvent[a] || 0;
    return total;
  };
  const stages = {
    landing_page_view: get('landing_page_view', 'page_view'),
    signup_started: get('signup_started'),
    signup_completed: get('signup_completed', 'sign_up'),
    profile_completed: get('profile_completed', 'onboarding_completed'),
    mode_selected: get('mode_selected'),
    location_completed: get('location_completed'),
    discover_started: get('discover_started', 'discover_viewed', 'match_search_clicked'),
    like_or_connection_sent: get('like_or_connection_sent', 'request_sent'),
    match_created: get('match_created', 'match_shown'),
    first_message_sent: get('first_message_sent', 'chat_started'),
    meaningful_conversation: get('meaningful_conversation'),
    return_visit: get('return_visit'),
    pricing_viewed: get('pricing_viewed', 'view_pricing'),
    checkout_started: get('checkout_started', 'begin_checkout'),
    verified_purchase: get('purchase')
  };
  const rates = {};
  const keys = Object.keys(stages);
  for (let i = 1; i < keys.length; i++) {
    const prev = stages[keys[i - 1]];
    const curr = stages[keys[i]];
    rates[`${keys[i - 1]}_to_${keys[i]}`] =
      prev > 0 ? Number((curr / prev).toFixed(4)) : null;
  }
  return { stages, rates, missingStageEvents: FUNNEL_EVENTS.filter((e) => !(e in byEvent)) };
}

const ga4Id = process.env.GA4_PROPERTY_ID;
const ga4Creds = process.env.GOOGLE_ANALYTICS_CREDENTIALS_JSON;
const stripeKey = process.env.STRIPE_RESTRICTED_READ_KEY;

if (ga4Id && ga4Creds) {
  report.sources.ga4 = 'configured';
} else {
  report.notes.push('GA4 secrets missing (GA4_PROPERTY_ID and/or GOOGLE_ANALYTICS_CREDENTIALS_JSON).');
}

if (stripeKey) {
  report.sources.stripe = 'configured';
} else {
  report.notes.push('STRIPE_RESTRICTED_READ_KEY missing — use read-only restricted key only.');
}

const ga4Ready = report.sources.ga4 === 'configured';
const stripeReady = report.sources.stripe === 'configured';

for (const w of windows) {
  const entry = { start: w.start, end: w.end, ga4: null, stripe: null, metro: null };
  if (ga4Ready) {
    try {
      entry.ga4 = await fetchGa4Events(ga4Id, ga4Creds, w.start, w.end);
      if (entry.ga4) report.sources.ga4 = 'ok';
      entry.metro = await fetchGa4Metro(ga4Id, ga4Creds, w.start, w.end);
      if (entry.metro && w.label === '7d') {
        report.marketplaceDensity.byMetro = entry.metro;
      }
    } catch (e) {
      report.notes.push(`GA4 ${w.label} failed: ${e instanceof Error ? e.message : e}`);
    }
  }
  if (stripeReady) {
    try {
      const startUnix = Math.floor(new Date(w.start + 'T00:00:00Z').getTime() / 1000);
      const raw = await fetchStripe(stripeKey, startUnix);
      entry.stripe = summarizeStripe(raw);
      if (entry.stripe) report.sources.stripe = 'ok';
    } catch (e) {
      report.notes.push(`Stripe ${w.label} failed: ${e instanceof Error ? e.message : e}`);
    }
  }
  report.windows[w.label] = entry;
  if (entry.ga4) {
    report.funnelSummary[w.label] = buildFunnelSummary(sumEventsByName(entry.ga4));
  }
}

fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `funnel-${stamp}.json`);
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ wrote: outPath, sources: report.sources, notes: report.notes }, null, 2));
