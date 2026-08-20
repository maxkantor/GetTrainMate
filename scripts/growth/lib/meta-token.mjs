/**
 * Meta Page token lifecycle for GetTrainMate Facebook + Instagram publish.
 * Never log, return in reports, or stringify raw access tokens or app secrets.
 */
export const GRAPH_VERSION = 'v21.0';
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export const META_SSM = {
  pageId: '/gettrainmate/growth/facebook-page-id',
  pageToken: '/gettrainmate/growth/meta-page-access-token',
  appId: '/gettrainmate/growth/meta-app-id',
  appSecret: '/gettrainmate/growth/meta-app-secret',
  tokenInstalledAt: '/gettrainmate/growth/meta-token-installed-at',
  tokenExpiresAt: '/gettrainmate/growth/meta-token-expires-at',
  tokenLastValidatedAt: '/gettrainmate/growth/meta-token-last-validated-at',
  tokenType: '/gettrainmate/growth/meta-token-type',
  igUserId: '/gettrainmate/growth/instagram-business-account-id',
  igUsername: '/gettrainmate/growth/instagram-username'
};

/** Canonical GetTrainMate destinations (identifiers, not secrets). */
export const GTM_PAGE_ID = '1138684902641972';
export const GTM_PAGE_NAME = 'Get Train Mate App';
export const GTM_IG_BUSINESS_ID = '17841434503711452';
export const GTM_IG_USERNAME = 'gettrainmate';

export const REQUIRED_PAGE_TASKS = ['CREATE_CONTENT', 'MANAGE', 'ADVERTISE', 'ANALYZE'];

export const META_AUTH_STATES = {
  META_VALID: 'META_VALID',
  META_TOKEN_EXPIRED: 'META_TOKEN_EXPIRED',
  META_TOKEN_REVOKED: 'META_TOKEN_REVOKED',
  META_PERMISSION_ERROR: 'META_PERMISSION_ERROR',
  META_PAGE_MISMATCH: 'META_PAGE_MISMATCH',
  META_INSTAGRAM_MISMATCH: 'META_INSTAGRAM_MISMATCH',
  META_GRAPH_UNAVAILABLE: 'META_GRAPH_UNAVAILABLE',
  META_AUTH_UNKNOWN: 'META_AUTH_UNKNOWN',
  META_TOKEN_MISSING: 'META_TOKEN_MISSING',
  META_CONFIG_MISSING: 'META_CONFIG_MISSING'
};

const SECRET_PATTERNS = [
  /access_token=[^&\s"']+/gi,
  /fb_exchange_token=[^&\s"']+/gi,
  /client_secret=[^&\s"']+/gi,
  /input_token=[^&\s"']+/gi,
  /EAA[A-Za-z0-9]+/g,
  /sk_live_[A-Za-z0-9]+/g,
  /rk_live_[A-Za-z0-9]+/g
];

export function redactSecrets(input) {
  let s = String(input ?? '');
  for (const re of SECRET_PATTERNS) s = s.replace(re, '[REDACTED]');
  return s;
}

export function safeErrorMessage(err) {
  if (!err) return 'unknown_error';
  if (typeof err === 'string') return redactSecrets(err).slice(0, 220);
  const msg = err.message || err.error_user_msg || err.type || 'error';
  return redactSecrets(String(msg)).slice(0, 220);
}

export function classifyGraphAuthError({ code, subcode, message } = {}) {
  const c = Number(code);
  const sc = Number(subcode);
  const msg = String(message || '').toLowerCase();

  if (c === 190) {
    if (sc === 463 || msg.includes('session has expired') || msg.includes('access token has expired')) {
      return META_AUTH_STATES.META_TOKEN_EXPIRED;
    }
    if (
      sc === 467 ||
      msg.includes('user logged out') ||
      msg.includes('session is invalid') ||
      msg.includes('has not authorized')
    ) {
      return META_AUTH_STATES.META_TOKEN_REVOKED;
    }
    if (sc === 458 || msg.includes('app not installed')) {
      return META_AUTH_STATES.META_TOKEN_REVOKED;
    }
    if (sc === 460 || msg.includes('password changed')) {
      return META_AUTH_STATES.META_TOKEN_REVOKED;
    }
    return META_AUTH_STATES.META_AUTH_UNKNOWN;
  }
  if (c === 10 || c === 200 || c === 294 || msg.includes('permission')) {
    return META_AUTH_STATES.META_PERMISSION_ERROR;
  }
  if (!Number.isFinite(c) && (msg.includes('fetch failed') || msg.includes('network') || msg.includes('enotfound'))) {
    return META_AUTH_STATES.META_GRAPH_UNAVAILABLE;
  }
  return META_AUTH_STATES.META_AUTH_UNKNOWN;
}

export function parseGraphErrorBody(json) {
  const err = json?.error || {};
  return {
    code: err.code ?? null,
    subcode: err.error_subcode ?? null,
    type: err.type ?? null,
    message: safeErrorMessage(err.message || err.error_user_msg || 'graph_error')
  };
}

export function extractPageTokenFromAccounts(accountsPayload, expectedPageId = GTM_PAGE_ID) {
  const data = Array.isArray(accountsPayload?.data) ? accountsPayload.data : [];
  const match = data.find((p) => String(p?.id) === String(expectedPageId));
  if (!match) {
    return {
      ok: false,
      state: META_AUTH_STATES.META_PAGE_MISMATCH,
      error: 'gettrainmate_page_not_in_accounts',
      pageNames: data.map((p) => ({ id: p?.id, name: p?.name })).filter((p) => p.id)
    };
  }
  if (!match.access_token) {
    return { ok: false, state: META_AUTH_STATES.META_TOKEN_MISSING, error: 'page_access_token_missing_on_account' };
  }
  return {
    ok: true,
    pageId: String(match.id),
    pageName: match.name || GTM_PAGE_NAME,
    tasks: Array.isArray(match.tasks) ? match.tasks : [],
    pageAccessToken: match.access_token
  };
}

export function parseLongLivedExchangeResponse(json) {
  if (!json?.access_token) {
    return { ok: false, error: 'missing_access_token_in_exchange_response', graph: parseGraphErrorBody(json) };
  }
  const expiresIn = Number(json.expires_in);
  return {
    ok: true,
    accessToken: json.access_token,
    tokenType: json.token_type || 'bearer',
    expiresIn: Number.isFinite(expiresIn) ? expiresIn : null,
    expiresAtIso:
      Number.isFinite(expiresIn) && expiresIn > 0
        ? new Date(Date.now() + expiresIn * 1000).toISOString()
        : null
  };
}

export function buildAppAccessToken(appId, appSecret) {
  if (!appId || !appSecret) return null;
  return `${appId}|${appSecret}`;
}

export function summarizeDebugToken(debugData) {
  const d = debugData?.data || debugData || {};
  const expiresAt = d.expires_at;
  let expiresLabel = 'unknown';
  if (expiresAt === 0 || expiresAt === '0') expiresLabel = 'no_explicit_expiry';
  else if (Number(expiresAt) > 0) expiresLabel = new Date(Number(expiresAt) * 1000).toISOString();
  return {
    is_valid: !!d.is_valid,
    app_id: d.app_id ? String(d.app_id) : null,
    type: d.type || null,
    expires_at: expiresLabel,
    data_access_expires_at: d.data_access_expires_at
      ? Number(d.data_access_expires_at) === 0
        ? 'no_explicit_expiry'
        : new Date(Number(d.data_access_expires_at) * 1000).toISOString()
      : 'unknown',
    scopes: Array.isArray(d.scopes) ? d.scopes : [],
    granular_scopes: Array.isArray(d.granular_scopes) ? d.granular_scopes : []
  };
}

export function configurationPresence({ pageToken, pageId, igUserId } = {}) {
  const hasToken = Boolean(String(pageToken || '').trim());
  const hasPage = Boolean(String(pageId || '').trim());
  const hasIg = Boolean(String(igUserId || '').trim());
  return {
    configuration: hasToken && hasPage && hasIg ? 'PRESENT' : 'MISSING',
    hasToken,
    hasPage,
    hasIg
  };
}

/**
 * Lightweight credential validation — no feed/media publish.
 */
export async function validateMetaCredentials({
  pageToken,
  pageId = GTM_PAGE_ID,
  igUserId = GTM_IG_BUSINESS_ID,
  expectedPageId = GTM_PAGE_ID,
  expectedIgUserId = GTM_IG_BUSINESS_ID,
  appId,
  appSecret,
  fetchImpl = fetch
} = {}) {
  const config = configurationPresence({ pageToken, pageId, igUserId });
  if (!config.hasToken) {
    return {
      ok: false,
      state: META_AUTH_STATES.META_TOKEN_MISSING,
      configuration: config.configuration,
      authentication: 'INVALID',
      facebookPublishing: 'BLOCKED',
      instagramPublishing: 'BLOCKED',
      ownerActionRequired: true,
      page: null,
      instagram: null,
      debug: null,
      graph: null
    };
  }
  if (!config.hasPage || !config.hasIg) {
    return {
      ok: false,
      state: META_AUTH_STATES.META_CONFIG_MISSING,
      configuration: config.configuration,
      authentication: 'INVALID',
      facebookPublishing: 'BLOCKED',
      instagramPublishing: 'BLOCKED',
      ownerActionRequired: true,
      page: null,
      instagram: null,
      debug: null,
      graph: null
    };
  }

  let res;
  let json;
  try {
    const fields = 'id,name,instagram_business_account{id,username}';
    const url = `${GRAPH_BASE}/${encodeURIComponent(pageId)}?fields=${encodeURIComponent(fields)}`;
    res = await fetchImpl(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${pageToken}` }
    });
    json = await res.json().catch(() => ({}));
  } catch (e) {
    return {
      ok: false,
      state: META_AUTH_STATES.META_GRAPH_UNAVAILABLE,
      configuration: 'PRESENT',
      authentication: 'INVALID',
      facebookPublishing: 'BLOCKED',
      instagramPublishing: 'BLOCKED',
      ownerActionRequired: false,
      page: null,
      instagram: null,
      debug: null,
      graph: { code: null, subcode: null, message: safeErrorMessage(e) }
    };
  }

  if (!res.ok || json.error) {
    const graph = parseGraphErrorBody(json);
    const state = classifyGraphAuthError(graph);
    return {
      ok: false,
      state,
      configuration: 'PRESENT',
      authentication: 'INVALID',
      facebookPublishing: 'BLOCKED',
      instagramPublishing: 'BLOCKED',
      ownerActionRequired: true,
      page: null,
      instagram: null,
      debug: null,
      graph
    };
  }

  const gotId = String(json.id || '');
  if (gotId && String(expectedPageId) && gotId !== String(expectedPageId)) {
    return {
      ok: false,
      state: META_AUTH_STATES.META_PAGE_MISMATCH,
      configuration: 'PRESENT',
      authentication: 'INVALID',
      facebookPublishing: 'BLOCKED',
      instagramPublishing: 'BLOCKED',
      ownerActionRequired: true,
      page: { id: gotId, name: json.name || null },
      instagram: null,
      debug: null,
      graph: null
    };
  }

  const ig = json.instagram_business_account || {};
  const gotIg = ig.id ? String(ig.id) : '';
  if (!gotIg || gotIg !== String(expectedIgUserId)) {
    return {
      ok: false,
      state: META_AUTH_STATES.META_INSTAGRAM_MISMATCH,
      configuration: 'PRESENT',
      authentication: 'INVALID',
      facebookPublishing: 'BLOCKED',
      instagramPublishing: 'BLOCKED',
      ownerActionRequired: true,
      page: { id: gotId || String(pageId), name: json.name || GTM_PAGE_NAME },
      instagram: { id: gotIg || null, username: ig.username || null },
      debug: null,
      graph: null
    };
  }

  let debug = null;
  const appToken = buildAppAccessToken(appId, appSecret);
  if (appToken) {
    try {
      const dbgUrl =
        `${GRAPH_BASE}/debug_token?input_token=${encodeURIComponent(pageToken)}` +
        `&access_token=${encodeURIComponent(appToken)}`;
      const dbgRes = await fetchImpl(dbgUrl);
      const dbgJson = await dbgRes.json().catch(() => ({}));
      if (dbgRes.ok && !dbgJson.error) {
        debug = summarizeDebugToken(dbgJson);
        if (debug.is_valid === false) {
          return {
            ok: false,
            state: META_AUTH_STATES.META_TOKEN_REVOKED,
            configuration: 'PRESENT',
            authentication: 'INVALID',
            facebookPublishing: 'BLOCKED',
            instagramPublishing: 'BLOCKED',
            ownerActionRequired: true,
            page: { id: gotId || String(pageId), name: json.name || GTM_PAGE_NAME },
            instagram: { id: gotIg, username: ig.username || GTM_IG_USERNAME },
            debug,
            graph: null
          };
        }
      }
    } catch {
      // debug_token is optional enrichment
    }
  }

  return {
    ok: true,
    state: META_AUTH_STATES.META_VALID,
    configuration: 'PRESENT',
    authentication: 'VALID',
    facebookPublishing: 'ALLOWED',
    instagramPublishing: 'ALLOWED',
    ownerActionRequired: false,
    page: { id: gotId || String(pageId), name: json.name || GTM_PAGE_NAME },
    instagram: { id: gotIg, username: ig.username || GTM_IG_USERNAME },
    debug,
    graph: null,
    validatedAt: new Date().toISOString()
  };
}

export function ownerSetupInstructions() {
  return [
    'OWNER ACTION REQUIRED — META REAUTHORIZATION',
    '1) In Meta Graph API Explorer, generate a short-lived User token for a GetTrainMate Page admin',
    '   with pages_show_list, pages_manage_posts, pages_read_engagement, instagram_basic, instagram_content_publish.',
    '2) Ensure SSM has Meta App credentials (one-time):',
    '   /gettrainmate/growth/meta-app-id (String) and /gettrainmate/growth/meta-app-secret (SecureString).',
    '3) Run locally (never paste the token into chat/email):',
    '   $env:META_TEMP_USER_TOKEN="<temporary_user_token>"',
    '   node scripts/growth/setup-meta-token.mjs',
    '   Remove-Item Env:META_TEMP_USER_TOKEN',
    'The script exchanges for a long-lived User token, retrieves the GetTrainMate Page token from /me/accounts,',
    'validates Facebook Page + Instagram Business Account, and stores the Page token in SSM SecureString.'
  ].join('\n');
}

export function authReportFields(validation, meta = {}) {
  const base = {
    configuration: validation?.configuration || meta.configuration || 'MISSING',
    authentication: validation?.authentication || 'INVALID',
    status: validation?.state || META_AUTH_STATES.META_AUTH_UNKNOWN,
    facebookPublishing: validation?.facebookPublishing || 'BLOCKED',
    instagramPublishing: validation?.instagramPublishing || 'BLOCKED',
    page: validation?.page?.name || meta.pageName || GTM_PAGE_NAME,
    pageId: validation?.page?.id || meta.pageId || GTM_PAGE_ID,
    instagram: validation?.instagram?.username
      ? `@${validation.instagram.username}`
      : `@${GTM_IG_USERNAME}`,
    instagramId: validation?.instagram?.id || meta.igUserId || GTM_IG_BUSINESS_ID,
    tokenLastValidated: validation?.validatedAt || meta.lastValidatedAt || null,
    tokenExpires: validation?.debug?.expires_at || meta.expiresAt || 'unknown',
    tokenType: validation?.debug?.type || meta.tokenType || 'unknown',
    ownerActionRequired: validation?.ownerActionRequired === false ? 'NO' : 'YES',
    graphCode: validation?.graph?.code ?? null,
    graphSubcode: validation?.graph?.subcode ?? null
  };
  return base;
}
