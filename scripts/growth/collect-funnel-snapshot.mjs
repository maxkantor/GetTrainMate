#!/usr/bin/env node
/**
 * Collect 7d + 30d funnel/revenue snapshot for GetTrainMate growth experiments.
 * Uses canonical metric definitions — never sums duplicate event aliases.
 * Never prints secret values. Missing sources are reported, not invented.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSsmSecretsIntoEnv } from './load-ssm-secrets-into-env.mjs';
import { GA4_FUNNEL_EVENT_NAMES, EXP001, SITE } from './lib/metric-definitions.mjs';
import {
  aggregateGa4ByEvent,
  normalizeGa4Window,
  normalizeStripe,
  buildScoreboardRow
} from './lib/normalize-metrics.mjs';
import { reconcileSnapshot, applyReconciliationBlocks } from './lib/reconcile.mjs';
import { fetchMetroDensity } from './lib/crm-metro.mjs';
import { attributeExp001PaidConversions } from './lib/exp001-attribution.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEASUREMENT_ID = 'G-C29M8NWNY4';

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
  site: SITE.origin,
  ssm: ssmLoad,
  sources: { ga4: 'missing', stripe: 'missing', adminCrm: 'unavailable' },
  marketplaceDensity: {
    assumptionMetro: 'Atlanta, Georgia',
    assumptionNote:
      'Default focus metro until aggregated CRM/GA4 metro data is available. Validate on each growth run.',
    byMetro: null,
    status: 'unavailable',
    reason:
      'GA4 customEvent:metro not populated; Admin CRM metro aggregates require app datastore access not granted to the growth SES IAM user.'
  },
  windows: {},
  scoreboard: {},
  experimentAttribution: {},
  reconciliation: null,
  notes: []
};

async function fetchGa4Report(propertyId, credentialsJson, body) {
  const creds = JSON.parse(credentialsJson);
  const { GoogleAuth } = await import('google-auth-library').catch(() => ({ GoogleAuth: null }));
  if (!GoogleAuth) {
    report.notes.push('google-auth-library not installed; run: npm i --prefix scripts/growth --ignore-scripts');
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

/** Event-only report (no channel) so totalUsers is safe. */
async function fetchGa4Events(propertyId, credentialsJson, startDate, endDate) {
  return fetchGa4Report(propertyId, credentialsJson, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'eventName' }],
    metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        inListFilter: { values: GA4_FUNNEL_EVENT_NAMES }
      }
    }
  });
}

/** EXP-001: page views for Atlanta landing. */
async function fetchGa4PagePath(propertyId, credentialsJson, startDate, endDate, pagePath) {
  return fetchGa4Report(propertyId, credentialsJson, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'pagePath' }, { name: 'eventName' }],
    metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
    dimensionFilter: {
      andGroup: {
        expressions: [
          {
            filter: {
              fieldName: 'pagePath',
              stringFilter: { matchType: 'EXACT', value: pagePath }
            }
          },
          {
            filter: {
              fieldName: 'eventName',
              inListFilter: {
                values: ['page_view', 'landing_page_view', 'signup_started', 'signup_completed', 'sign_up']
              }
            }
          }
        ]
      }
    }
  });
}

async function fetchStripeSessions(key, startUnix) {
  const params = new URLSearchParams({
    'created[gte]': String(startUnix),
    limit: '100',
    status: 'complete',
    'expand[]': 'data.line_items'
  });
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions?${params}`, {
    headers: { Authorization: `Bearer ${key}` }
  });
  if (!res.ok) {
    report.notes.push(`Stripe sessions error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return null;
  }
  return res.json();
}

async function fetchStripeCharges(key, startUnix) {
  const params = new URLSearchParams({
    'created[gte]': String(startUnix),
    limit: '100'
  });
  const res = await fetch(`https://api.stripe.com/v1/charges?${params}`, {
    headers: { Authorization: `Bearer ${key}` }
  });
  if (!res.ok) {
    report.notes.push(`Stripe charges error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return null;
  }
  return res.json();
}

function summarizeExp001(pagePathReport, windowLabel, stripeNormalized) {
  const byEvent = {};
  let pageViews = 0;
  let pageViewUsers = null;
  for (const row of pagePathReport?.rows ?? []) {
    const pathDim = row.dimensionValues?.[0]?.value ?? '';
    const eventName = row.dimensionValues?.[1]?.value ?? '';
    const eventCount = Number(row.metricValues?.[0]?.value ?? 0);
    const totalUsers = Number(row.metricValues?.[1]?.value ?? 0);
    if (pathDim !== EXP001.path) continue;
    byEvent[eventName] = (byEvent[eventName] || 0) + eventCount;
    if (eventName === 'page_view' || eventName === 'landing_page_view') {
      pageViews += eventCount;
      pageViewUsers = (pageViewUsers ?? 0) + totalUsers;
    }
  }

  const signupStarts = byEvent.signup_started ?? 0;
  // Prefer signup_completed; do not sum with sign_up.
  const signupCompleted =
    byEvent.signup_completed > 0 ? byEvent.signup_completed : byEvent.sign_up ?? 0;

  const landings = pageViews;
  const toStart =
    landings > 0 ? Number((signupStarts / landings).toFixed(4)) : null;
  const toComplete =
    landings > 0 ? Number((signupCompleted / landings).toFixed(4)) : null;
  const paid = attributeExp001PaidConversions(stripeNormalized?.live_paid_sessions || []);

  return {
    experimentId: EXP001.id,
    window: windowLabel,
    path: EXP001.path,
    landings: { value: landings, unit: 'events', available: pagePathReport != null },
    landing_users: {
      value: pageViewUsers,
      unit: 'users',
      available: pageViewUsers != null
    },
    signup_starts: { value: signupStarts, unit: 'events', available: pagePathReport != null },
    completed_signups: {
      value: signupCompleted,
      unit: 'events',
      available: pagePathReport != null,
      note: 'Attributed only when event fired on Atlanta path; may undercount if signup happens on /signup.'
    },
    landing_to_signup_start: toStart,
    landing_to_completed_signup: toComplete,
    attributed_paid_conversions: paid,
    evaluationDate: EXP001.evaluationDate,
    rawPathEvents: byEvent
  };
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

report.notes.push(
  'Admin CRM metro aggregates: use GROWTH_METRO_READ_TOKEN or GROWTH_CRM_ADMIN_* via HTTPS Admin API (not SES IAM DynamoDB).'
);

const ga4Ready = report.sources.ga4 === 'configured';
const stripeReady = report.sources.stripe === 'configured';

try {
  const metro = await fetchMetroDensity({ minCohort: 3 });
  report.marketplaceDensity = {
    ...report.marketplaceDensity,
    status: metro.status,
    reason: metro.reason || null,
    cause: metro.cause || null,
    httpStatus: metro.httpStatus || null,
    errorCode: metro.errorCode || null,
    customerDataExposed: metro.customerDataExposed === true,
    minCohort: metro.minCohort ?? 3,
    suppressedMetroCount: metro.suppressedMetroCount ?? 0,
    discoverUsersNote: metro.discoverUsersNote || null,
    returningUsersNote: metro.returningUsersNote || null,
    byMetro: metro.status === 'ok' ? metro.metros : null,
    authMethod: metro.authMethod || null
  };
  report.sources.adminCrm = metro.status === 'ok' ? 'ok' : 'unavailable';
  if (metro.status !== 'ok') {
    report.notes.push(
      metro.cause
        ? `Metro CRM: Unavailable (${metro.errorCode || 'unconfigured'})`
        : 'Metro CRM: Unavailable'
    );
  }
} catch (e) {
  report.notes.push(`Metro CRM fetch failed: ${e instanceof Error ? e.message : e}`);
  report.sources.adminCrm = 'unavailable';
}

for (const w of windows) {
  const entry = {
    start: w.start,
    end: w.end,
    ga4: null,
    ga4ByEvent: null,
    ga4Normalized: null,
    stripe: null,
    stripeNormalized: null,
    exp001: null
  };

  if (ga4Ready) {
    try {
      entry.ga4 = await fetchGa4Events(ga4Id, ga4Creds, w.start, w.end);
      if (entry.ga4) {
        report.sources.ga4 = 'ok';
        entry.ga4ByEvent = aggregateGa4ByEvent(entry.ga4, { hasChannelDimension: false });
        entry.ga4Normalized = normalizeGa4Window(entry.ga4ByEvent);
        for (const warn of entry.ga4Normalized.warnings) {
          report.notes.push(`[${w.label}] ${warn}`);
        }
      }
      entry._pathReport = await fetchGa4PagePath(
        ga4Id,
        ga4Creds,
        w.start,
        w.end,
        EXP001.path
      );
    } catch (e) {
      report.notes.push(`GA4 ${w.label} failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  if (stripeReady) {
    try {
      const startUnix = Math.floor(new Date(`${w.start}T00:00:00Z`).getTime() / 1000);
      const sessions = await fetchStripeSessions(stripeKey, startUnix);
      const charges = await fetchStripeCharges(stripeKey, startUnix);
      entry.stripeNormalized = normalizeStripe({ sessions, charges });
      entry.stripe = {
        livePaidSessions: entry.stripeNormalized.live_checkout_sessions,
        livePayments: entry.stripeNormalized.live_payments,
        attributedLivePayments: entry.stripeNormalized.attributed_live_payments,
        unattributedLivePayments: entry.stripeNormalized.unattributed_live_payments,
        uniquePayingCustomers: entry.stripeNormalized.unique_paying_customers,
        uniquePayingCustomersAvailable: entry.stripeNormalized.unique_paying_customers_available,
        uniquePayingCustomersMethod: entry.stripeNormalized.unique_paying_customers_method,
        revenueLiveUsd: entry.stripeNormalized.revenue_live_usd,
        testPaidSessions: entry.stripeNormalized.test_paid_sessions,
        liveSucceededCharges: entry.stripeNormalized.live_succeeded_charges,
        accountWideLiveSessions: entry.stripeNormalized.account_wide_live_sessions,
        reconciliationComplete: entry.stripeNormalized.reconciliation_complete,
        verifiedBaselineCustomers: entry.stripeNormalized.verified_baseline_customers
      };
      report.sources.stripe = 'ok';
      for (const warn of entry.stripeNormalized.warnings) {
        report.notes.push(`[${w.label}] ${warn}`);
      }
    } catch (e) {
      report.notes.push(`Stripe ${w.label} failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  if (entry._pathReport || entry.stripeNormalized) {
    entry.exp001 = summarizeExp001(entry._pathReport, w.label, entry.stripeNormalized);
  }
  delete entry._pathReport;

  report.windows[w.label] = entry;
  report.scoreboard[w.label] = buildScoreboardRow(
    entry.ga4Normalized,
    entry.stripeNormalized
  );
  if (entry.exp001) {
    report.experimentAttribution[w.label] = entry.exp001;
  }
}

const recon = reconcileSnapshot({
  scoreboard7d: report.scoreboard['7d'],
  scoreboard30d: report.scoreboard['30d'],
  stripe7d: report.windows['7d']?.stripeNormalized,
  stripe30d: report.windows['30d']?.stripeNormalized
});
report.reconciliation = recon;
if (!recon.ok) {
  report.scoreboard['7d'] = applyReconciliationBlocks(
    report.scoreboard['7d'],
    recon.blockedMetrics,
    '7d'
  );
  report.scoreboard['30d'] = applyReconciliationBlocks(
    report.scoreboard['30d'],
    recon.blockedMetrics,
    '30d'
  );
  report.notes.push('Reconciliation failed — affected metrics marked Unknown.');
  for (const w of recon.warnings) report.notes.push(`Reconcile: ${w}`);
}

fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `funnel-${stamp}.json`);
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    {
      wrote: outPath,
      sources: report.sources,
      reconciliationOk: recon.ok,
      notes: report.notes
    },
    null,
    2
  )
);
