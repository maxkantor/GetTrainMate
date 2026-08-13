/**
 * Fetch aggregated metro density from Admin CRM API.
 * Uses a separate credential path — never DynamoDB via the SES-only growth IAM user.
 *
 * Auth (first match):
 * 1. GROWTH_METRO_READ_TOKEN → header X-Growth-Metro-Token
 * 2. GROWTH_CRM_ADMIN_TOKEN → header X-Admin-Token
 * 3. GROWTH_CRM_ADMIN_EMAIL + GROWTH_CRM_ADMIN_PASSWORD → POST /api/admin/login
 */

const DEFAULT_API =
  process.env.GROWTH_CRM_API_BASE_URL ||
  process.env.GTM_API_BASE_URL ||
  'https://goskwzjzjg.execute-api.us-east-1.amazonaws.com';

export async function fetchMetroDensity({ minCohort = 3 } = {}) {
  const base = String(DEFAULT_API).replace(/\/$/, '');
  const metroUrl = `${base}/api/admin/metrics/metro?minCohort=${encodeURIComponent(String(minCohort))}`;

  const growthToken = process.env.GROWTH_METRO_READ_TOKEN?.trim();
  if (growthToken) {
    const res = await fetch(metroUrl, {
      headers: { 'X-Growth-Metro-Token': growthToken, Accept: 'application/json' }
    });
    return interpretMetroResponse(res, 'growth_metro_token');
  }

  let adminToken = process.env.GROWTH_CRM_ADMIN_TOKEN?.trim() || '';
  if (!adminToken) {
    const email = process.env.GROWTH_CRM_ADMIN_EMAIL?.trim();
    const password = process.env.GROWTH_CRM_ADMIN_PASSWORD;
    if (email && password) {
      const loginRes = await fetch(`${base}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!loginRes.ok) {
        return {
          status: 'unavailable',
          reason: `Admin CRM login failed (${loginRes.status}). Check GROWTH_CRM_ADMIN_EMAIL/PASSWORD.`,
          authMethod: 'admin_login',
          metros: []
        };
      }
      const body = await loginRes.json();
      adminToken = body?.token || body?.Token || body?.sessionToken || '';
      if (!adminToken) {
        return {
          status: 'unavailable',
          reason: 'Admin CRM login succeeded but no token returned.',
          authMethod: 'admin_login',
          metros: []
        };
      }
    }
  }

  if (!adminToken) {
    return {
      status: 'unavailable',
      reason:
        'Metro CRM credentials missing. Set GROWTH_METRO_READ_TOKEN (preferred) or GROWTH_CRM_ADMIN_TOKEN / GROWTH_CRM_ADMIN_EMAIL+PASSWORD in Cursor secrets or SSM /gettrainmate/growth/*. Do not grant DynamoDB to the SES growth IAM user.',
      authMethod: 'none',
      metros: []
    };
  }

  const res = await fetch(metroUrl, {
    headers: { 'X-Admin-Token': adminToken, Accept: 'application/json' }
  });
  return interpretMetroResponse(res, adminToken === process.env.GROWTH_CRM_ADMIN_TOKEN?.trim() ? 'admin_token' : 'admin_login');
}

async function interpretMetroResponse(res, authMethod) {
  if (!res.ok) {
    const text = (await res.text()).slice(0, 200);
    return {
      status: 'unavailable',
      reason: `Metro API HTTP ${res.status}: ${text}`,
      authMethod,
      metros: []
    };
  }
  const data = await res.json();
  return {
    status: data.status || 'ok',
    reason: data.reason || null,
    minCohort: data.minCohort ?? 3,
    suppressedMetroCount: data.suppressedMetroCount ?? 0,
    discoverUsersNote: data.discoverUsersNote || null,
    returningUsersNote: data.returningUsersNote || null,
    metros: Array.isArray(data.metros) ? data.metros : [],
    authMethod,
    generatedAtUtc: data.generatedAtUtc || null
  };
}
