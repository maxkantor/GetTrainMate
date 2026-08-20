#!/usr/bin/env node
/**
 * One-time Meta credential setup for GetTrainMate owned social.
 *
 *   $env:META_TEMP_USER_TOKEN = "<short-lived User token>"
 *   node scripts/growth/setup-meta-token.mjs
 *   Remove-Item Env:META_TEMP_USER_TOKEN
 *
 * Never prints tokens or app secrets. Writes Page token to SSM SecureString.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  GRAPH_BASE,
  GTM_IG_BUSINESS_ID,
  GTM_IG_USERNAME,
  GTM_PAGE_ID,
  META_AUTH_STATES,
  META_SSM,
  extractPageTokenFromAccounts,
  ownerSetupInstructions,
  parseGraphErrorBody,
  parseLongLivedExchangeResponse,
  redactSecrets,
  validateMetaCredentials
} from './lib/meta-token.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGION = process.env.AWS_REGION || 'us-east-1';
const STATUS_PATH = path.join(__dirname, '../../docs/growth/owned-social/meta-auth-status.json');

function getSsm(name, secure = false) {
  const args = [
    'ssm',
    'get-parameter',
    '--name',
    name,
    '--region',
    REGION,
    '--query',
    'Parameter.Value',
    '--output',
    'text'
  ];
  if (secure) args.splice(4, 0, '--with-decryption');
  const r = spawnSync('aws', args, { encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) return null;
  const v = (r.stdout || '').trim();
  return !v || v === 'None' ? null : v;
}

function putSsm(name, value, { secure = false, description = '' } = {}) {
  if (!value) return { ok: false, error: 'empty_value' };
  const args = [
    'ssm',
    'put-parameter',
    '--name',
    name,
    '--region',
    REGION,
    '--type',
    secure ? 'SecureString' : 'String',
    '--overwrite',
    '--value',
    value
  ];
  if (description) {
    args.push('--description', description);
  }
  const r = spawnSync('aws', args, { encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) {
    return { ok: false, error: 'put_failed', detail: redactSecrets((r.stderr || '').slice(0, 200)) };
  }
  return { ok: true, name };
}

async function graphGet(urlPath, accessToken) {
  const sep = urlPath.includes('?') ? '&' : '?';
  const url = `${GRAPH_BASE}${urlPath}${sep}access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok && !json.error, status: res.status, json };
}

function writeStatus(status) {
  fs.mkdirSync(path.dirname(STATUS_PATH), { recursive: true });
  fs.writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2) + '\n', 'utf8');
}

async function main() {
  const tempUser = (process.env.META_TEMP_USER_TOKEN || '').trim();
  if (!tempUser) {
    console.error(
      JSON.stringify({
        ok: false,
        error: 'META_TEMP_USER_TOKEN_missing',
        instructions: ownerSetupInstructions()
      })
    );
    process.exit(2);
  }

  const appId = (process.env.META_APP_ID || getSsm(META_SSM.appId, false) || '').trim();
  const appSecret = (process.env.META_APP_SECRET || getSsm(META_SSM.appSecret, true) || '').trim();
  const expectedPageId = (process.env.FACEBOOK_PAGE_ID || getSsm(META_SSM.pageId, false) || GTM_PAGE_ID).trim();
  const expectedIgId = (
    process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID ||
    getSsm(META_SSM.igUserId, false) ||
    GTM_IG_BUSINESS_ID
  ).trim();

  if (!appId || !appSecret) {
    console.error(
      JSON.stringify({
        ok: false,
        error: 'meta_app_credentials_missing',
        need: [META_SSM.appId, META_SSM.appSecret],
        instructions:
          'Store Meta App ID as String and App Secret as SecureString under /gettrainmate/growth/, then re-run setup-meta-token.mjs'
      })
    );
    process.exit(2);
  }

  // 1) Exchange short-lived User token → long-lived User token
  const exchangeUrl =
    `${GRAPH_BASE}/oauth/access_token?grant_type=fb_exchange_token` +
    `&client_id=${encodeURIComponent(appId)}` +
    `&client_secret=${encodeURIComponent(appSecret)}` +
    `&fb_exchange_token=${encodeURIComponent(tempUser)}`;
  let exchangeRes;
  let exchangeJson;
  try {
    exchangeRes = await fetch(exchangeUrl);
    exchangeJson = await exchangeRes.json().catch(() => ({}));
  } catch (e) {
    console.error(JSON.stringify({ ok: false, error: 'exchange_network', message: redactSecrets(String(e)) }));
    process.exit(1);
  }
  const exchanged = parseLongLivedExchangeResponse(exchangeJson);
  if (!exchanged.ok) {
    console.error(
      JSON.stringify({
        ok: false,
        error: 'long_lived_exchange_failed',
        state: META_AUTH_STATES.META_AUTH_UNKNOWN,
        graph: exchanged.graph || parseGraphErrorBody(exchangeJson)
      })
    );
    process.exit(1);
  }
  const longLivedUser = exchanged.accessToken;

  // 2) GET /me/accounts → Page token
  const accounts = await graphGet('/me/accounts?fields=id,name,access_token,tasks,instagram_business_account', longLivedUser);
  if (!accounts.ok) {
    console.error(
      JSON.stringify({
        ok: false,
        error: 'me_accounts_failed',
        graph: parseGraphErrorBody(accounts.json)
      })
    );
    process.exit(1);
  }
  const extracted = extractPageTokenFromAccounts(accounts.json, expectedPageId);
  if (!extracted.ok) {
    console.error(
      JSON.stringify({
        ok: false,
        error: extracted.error,
        state: extracted.state,
        pages: extracted.pageNames || []
      })
    );
    process.exit(1);
  }

  const pageToken = extracted.pageAccessToken;

  // 3) Validate Page + Instagram (no publish)
  const validation = await validateMetaCredentials({
    pageToken,
    pageId: expectedPageId,
    igUserId: expectedIgId,
    expectedPageId,
    expectedIgUserId: expectedIgId,
    appId,
    appSecret
  });
  if (!validation.ok) {
    console.error(
      JSON.stringify({
        ok: false,
        error: 'validation_failed',
        state: validation.state,
        graph: validation.graph,
        page: validation.page,
        instagram: validation.instagram
      })
    );
    process.exit(1);
  }

  // 4) Store Page token + safe metadata (never print token)
  const nowIso = new Date().toISOString();
  const putToken = putSsm(META_SSM.pageToken, pageToken, {
    secure: true,
    description: 'GetTrainMate Facebook Page access token (Facebook + Instagram Graph publish)'
  });
  if (!putToken.ok) {
    console.error(JSON.stringify({ ok: false, error: 'ssm_put_page_token_failed', detail: putToken.detail }));
    process.exit(1);
  }

  putSsm(META_SSM.pageId, expectedPageId, { secure: false, description: 'GetTrainMate Facebook Page id' });
  putSsm(META_SSM.igUserId, expectedIgId, {
    secure: false,
    description: 'GetTrainMate Instagram Business Account id'
  });
  putSsm(META_SSM.igUsername, GTM_IG_USERNAME, { secure: false });
  putSsm(META_SSM.tokenInstalledAt, nowIso, { secure: false });
  putSsm(META_SSM.tokenLastValidatedAt, validation.validatedAt || nowIso, { secure: false });
  putSsm(META_SSM.tokenType, validation.debug?.type || 'PAGE', { secure: false });
  const expires =
    validation.debug?.expires_at ||
    exchanged.expiresAtIso ||
    'unknown';
  putSsm(META_SSM.tokenExpiresAt, String(expires), { secure: false });

  const status = {
    ok: true,
    state: META_AUTH_STATES.META_VALID,
    configuration: 'PRESENT',
    authentication: 'VALID',
    pageId: validation.page?.id || expectedPageId,
    pageName: validation.page?.name || null,
    instagramId: validation.instagram?.id || expectedIgId,
    instagramUsername: validation.instagram?.username || GTM_IG_USERNAME,
    tokenInstalledAt: nowIso,
    tokenLastValidatedAt: validation.validatedAt || nowIso,
    tokenExpiresAt: expires,
    tokenType: validation.debug?.type || 'PAGE',
    ssmPageToken: META_SSM.pageToken,
    ownerActionRequired: false
  };
  writeStatus(status);

  console.log(
    JSON.stringify({
      ok: true,
      state: META_AUTH_STATES.META_VALID,
      configuration: 'PRESENT',
      authentication: 'VALID',
      pageId: status.pageId,
      pageName: status.pageName,
      instagramId: status.instagramId,
      instagramUsername: status.instagramUsername,
      tokenExpiresAt: status.tokenExpiresAt,
      tokenType: status.tokenType,
      ssm: {
        pageToken: META_SSM.pageToken,
        pageId: META_SSM.pageId,
        igUserId: META_SSM.igUserId
      },
      statusFile: 'docs/growth/owned-social/meta-auth-status.json',
      next: 'Weekday publish will validate then post. Do not rotate the token daily.'
    })
  );
}

const invoked =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invoked) {
  main().catch((e) => {
    console.error(JSON.stringify({ ok: false, error: redactSecrets(String(e?.message || e)) }));
    process.exit(1);
  });
}
