/**
 * Fetch aggregated metro density from Admin CRM API.
 * Uses a separate credential path — never DynamoDB via the SES-only growth IAM user.
 */
const DEFAULT_API =
  process.env.GROWTH_CRM_API_BASE_URL ||
  process.env.GTM_API_BASE_URL ||
  'https://goskwzjzjg.execute-api.us-east-1.amazonaws.com';

function unconfiguredMetro() {
  return {
    status: 'unavailable',
    cause: 'GROWTH_METRO_READ_TOKEN is not configured',
    httpStatus: 503,
    errorCode: 'metro_token_unconfigured',
    customerDataExposed: false,
    reason: 'GROWTH_METRO_READ_TOKEN is not configured',
    authMethod: 'none',
    metros: []
  };
}

export async function fetchMetroDensity({ minCohort = 3 } = {}) {
  const base = String(DEFAULT_API).replace(/\/$/, '');
  const metroUrl = `${base}/api/admin/metrics/metro?minCohort=${encodeURIComponent(String(minCohort))}`;

  const growthToken = process.env.GROWTH_METRO_READ_TOKEN?.trim();
  if (!growthToken) {
    const email = process.env.GROWTH_CRM_ADMIN_EMAIL?.trim();
    const password = process.env.GROWTH_CRM_ADMIN_PASSWORD;
    const adminToken = process.env.GROWTH_CRM_ADMIN_TOKEN?.trim();
    if (!email && !password && !adminToken) {
      return unconfiguredMetro();
    }
  }

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
          cause: 'Admin CRM login failed',
          httpStatus: loginRes.status,
          errorCode: 'metro_admin_login_failed',
          customerDataExposed: false,
          reason: `Admin CRM login failed (${loginRes.status}).`,
          authMethod: 'admin_login',
          metros: []
        };
      }
      const body = await loginRes.json();
      adminToken = body?.token || body?.Token || body?.sessionToken || '';
      if (!adminToken) {
        return {
          status: 'unavailable',
          cause: 'Admin CRM login succeeded but no token returned',
          httpStatus: 503,
          errorCode: 'metro_admin_token_missing',
          customerDataExposed: false,
          reason: 'Admin CRM login succeeded but no token returned.',
          authMethod: 'admin_login',
          metros: []
        };
      }
    }
  }

  if (!adminToken) {
    return unconfiguredMetro();
  }

  const res = await fetch(metroUrl, {
    headers: { 'X-Admin-Token': adminToken, Accept: 'application/json' }
  });
  return interpretMetroResponse(
    res,
    adminToken === process.env.GROWTH_CRM_ADMIN_TOKEN?.trim() ? 'admin_token' : 'admin_login'
  );
}

async function interpretMetroResponse(res, authMethod) {
  if (!res.ok) {
    const status = res.status;
    const cause =
      status === 503
        ? 'GROWTH_METRO_READ_TOKEN is not configured'
        : `Metro API HTTP ${status}`;
    return {
      status: 'unavailable',
      cause,
      httpStatus: status === 500 ? 503 : status,
      errorCode: status === 503 || status === 500 ? 'metro_token_unconfigured' : `metro_http_${status}`,
      customerDataExposed: false,
      reason: cause,
      authMethod,
      metros: []
    };
  }
  const data = await res.json();
  return {
    status: data.status || 'ok',
    reason: data.reason || null,
    cause: data.cause || null,
    httpStatus: 200,
    errorCode: data.errorCode || null,
    customerDataExposed: false,
    minCohort: data.minCohort ?? 3,
    suppressedMetroCount: data.suppressedMetroCount ?? 0,
    discoverUsersNote: data.discoverUsersNote || null,
    returningUsersNote: data.returningUsersNote || null,
    metros: Array.isArray(data.metros) ? data.metros : [],
    authMethod,
    generatedAtUtc: data.generatedAtUtc || null
  };
}

export { unconfiguredMetro };
