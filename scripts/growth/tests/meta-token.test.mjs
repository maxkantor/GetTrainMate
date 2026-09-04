import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  META_AUTH_STATES,
  classifyGraphAuthError,
  extractPageTokenFromAccounts,
  parseLongLivedExchangeResponse,
  redactSecrets,
  summarizeDebugToken,
  validateMetaCredentials,
  GTM_PAGE_ID,
  GTM_IG_BUSINESS_ID
} from '../lib/meta-token.mjs';
import { composeGrowthEmailBody, resolveAcquisitionLead } from '../lib/growth-report.mjs';

describe('meta auth classification', () => {
  it('maps code 190 / subcode 463 to META_TOKEN_EXPIRED', () => {
    assert.equal(
      classifyGraphAuthError({
        code: 190,
        subcode: 463,
        message: 'Session has expired on Wednesday, 19-Aug-26 13:00:00 PDT'
      }),
      META_AUTH_STATES.META_TOKEN_EXPIRED
    );
  });

  it('maps code 190 / subcode 467 to META_TOKEN_REVOKED', () => {
    assert.equal(
      classifyGraphAuthError({
        code: 190,
        subcode: 467,
        message: 'The session is invalid because the user logged out'
      }),
      META_AUTH_STATES.META_TOKEN_REVOKED
    );
  });

  it('maps permission errors', () => {
    assert.equal(
      classifyGraphAuthError({ code: 200, message: 'Permissions error' }),
      META_AUTH_STATES.META_PERMISSION_ERROR
    );
  });

  it('maps network failures', () => {
    assert.equal(
      classifyGraphAuthError({ message: 'fetch failed' }),
      META_AUTH_STATES.META_GRAPH_UNAVAILABLE
    );
  });
});

describe('meta token helpers', () => {
  it('redacts tokens from strings', () => {
    const s = redactSecrets('access_token=EAABxyz123&client_secret=abc');
    assert.doesNotMatch(s, /EAABxyz/);
    assert.match(s, /REDACTED/);
  });

  it('extracts Page token without logging it', () => {
    const got = extractPageTokenFromAccounts(
      {
        data: [
          { id: '999', name: 'Other', access_token: 'SECRET_OTHER' },
          { id: GTM_PAGE_ID, name: 'Get Train Mate App', access_token: 'SECRET_PAGE', tasks: ['CREATE_CONTENT'] }
        ]
      },
      GTM_PAGE_ID
    );
    assert.equal(got.ok, true);
    assert.equal(got.pageId, GTM_PAGE_ID);
    assert.equal(got.pageAccessToken, 'SECRET_PAGE');
  });

  it('flags page mismatch', () => {
    const got = extractPageTokenFromAccounts({ data: [{ id: '1', name: 'x', access_token: 't' }] }, GTM_PAGE_ID);
    assert.equal(got.ok, false);
    assert.equal(got.state, META_AUTH_STATES.META_PAGE_MISMATCH);
  });

  it('parses long-lived exchange response', () => {
    const got = parseLongLivedExchangeResponse({
      access_token: 'LONG',
      expires_in: 5184000,
      token_type: 'bearer'
    });
    assert.equal(got.ok, true);
    assert.equal(got.accessToken, 'LONG');
    assert.ok(got.expiresAtIso);
  });

  it('summarizes debug_token without secrets', () => {
    const s = summarizeDebugToken({
      data: {
        is_valid: true,
        app_id: '123',
        type: 'PAGE',
        expires_at: 0,
        scopes: ['pages_manage_posts']
      }
    });
    assert.equal(s.is_valid, true);
    assert.equal(s.expires_at, 'no_explicit_expiry');
    assert.deepEqual(s.scopes, ['pages_manage_posts']);
  });

  it('validateMetaCredentials returns META_TOKEN_EXPIRED on Graph 190/463', async () => {
    const fetchImpl = async () => ({
      ok: false,
      json: async () => ({
        error: {
          message: 'Session has expired',
          code: 190,
          error_subcode: 463
        }
      })
    });
    const v = await validateMetaCredentials({
      pageToken: 'x',
      pageId: GTM_PAGE_ID,
      igUserId: GTM_IG_BUSINESS_ID,
      fetchImpl
    });
    assert.equal(v.ok, false);
    assert.equal(v.state, META_AUTH_STATES.META_TOKEN_EXPIRED);
    assert.equal(v.authentication, 'INVALID');
    assert.equal(v.configuration, 'PRESENT');
    assert.doesNotMatch(JSON.stringify(v), /pageToken|EAA/);
  });

  it('validateMetaCredentials succeeds with matching Page + IG', async () => {
    const fetchImpl = async (url) => {
      if (String(url).includes('debug_token')) {
        return {
          ok: true,
          json: async () => ({ data: { is_valid: true, type: 'PAGE', expires_at: 0, scopes: [] } })
        };
      }
      return {
        ok: true,
        json: async () => ({
          id: GTM_PAGE_ID,
          name: 'Get Train Mate App',
          instagram_business_account: { id: GTM_IG_BUSINESS_ID, username: 'gettrainmate' }
        })
      };
    };
    const v = await validateMetaCredentials({
      pageToken: 'x',
      pageId: GTM_PAGE_ID,
      igUserId: GTM_IG_BUSINESS_ID,
      appId: '1',
      appSecret: '2',
      fetchImpl
    });
    assert.equal(v.ok, true);
    assert.equal(v.state, META_AUTH_STATES.META_VALID);
    assert.equal(v.authentication, 'VALID');
  });
});

describe('growth report meta honesty', () => {
  it('does not say Meta ok when authentication failed', () => {
    const { text, html } = composeGrowthEmailBody({
      snapshot: {
        sources: { ga4: 'ok', stripe: 'ok' },
        scoreboard: {
          '7d': {},
          '30d': { unique_paying_customers: { value: 0, available: true }, revenue: { value: 0, available: true } }
        },
        reconciliation: { ok: true, warnings: [] },
        marketplaceDensity: { status: 'unavailable' },
        ownedSocial: {
          contentId: 'train-en-workout-partner',
          distributionAttempted: true,
          distributionExecuted: false,
          connectorHealthy: false,
          connectorBlocker: 'META_TOKEN_EXPIRED · Session has expired · code 190 · subcode 463',
          metaAuth: {
            configuration: 'PRESENT',
            authentication: 'INVALID',
            status: 'META_TOKEN_EXPIRED',
            facebookPublishing: 'BLOCKED',
            instagramPublishing: 'BLOCKED',
            ownerActionRequired: true,
            pageId: GTM_PAGE_ID,
            instagramId: GTM_IG_BUSINESS_ID,
            tokenExpires: 'expired'
          },
          facebook: { published: false },
          instagram: { published: false }
        }
      },
      health: { ok: true, checks: [] },
      experiments: [],
      generatedAt: new Date('2026-08-20T14:00:00Z')
    });
    assert.match(text, /Distribution attempted: YES/);
    assert.match(text, /Distribution executed: NO/);
    assert.match(text, /Technical distribution result: FAILED/);
    assert.match(text, /Meta authentication: INVALID/);
    assert.match(text, /Meta status: META_TOKEN_EXPIRED/);
    assert.doesNotMatch(text, /Meta ok/);
    assert.doesNotMatch(html, /Meta ok/);
    assert.match(html, /Meta authentication/);
    assert.match(html, /INVALID/);
    assert.match(text, /Completed profiles 30d \(GA4/);
  });

  it('owner action YES when metaAuth missing from snapshot', () => {
    const { text } = composeGrowthEmailBody({
      snapshot: {
        sources: {},
        scoreboard: { '7d': {}, '30d': { unique_paying_customers: { value: 0, available: true }, revenue: { value: 0, available: true } } },
        reconciliation: { ok: true, warnings: [] },
        marketplaceDensity: { status: 'unavailable' },
        ownedSocial: {}
      },
      health: { ok: true, checks: [{ name: 'api_health', ok: true }] },
      experiments: [],
      generatedAt: new Date('2026-09-04T14:00:00Z')
    });
    assert.match(text, /Meta configuration: UNKNOWN/);
    assert.match(text, /Meta authentication: INVALID/);
    assert.match(text, /Owner action required: YES/);
  });

  it('does not claim distribution without real post ids', () => {
    const lead = resolveAcquisitionLead({
      snapshot: {
        scoreboard: { '7d': {}, '30d': {} },
        ownedSocial: {
          distributionAttempted: true,
          distributionExecuted: false,
          metaAuth: {
            configuration: 'PRESENT',
            authentication: 'VALID',
            status: 'META_VALID',
            ownerActionRequired: false
          },
          facebook: { published: false, postId: '' },
          instagram: { published: false, postId: '' }
        }
      }
    });
    assert.equal(lead.distributionAttempted, 'YES');
    assert.equal(lead.distributionExecuted, 'NO');
    assert.equal(lead.technicalDistributionResult, 'FAILED');
  });
});

describe('meta report status mapping', () => {
  it('maps internal states to report statuses', async () => {
    const { toMetaReportStatus, META_AUTH_STATES, META_REPORT_STATES } = await import(
      '../lib/meta-token.mjs'
    );
    assert.equal(toMetaReportStatus(META_AUTH_STATES.META_TOKEN_EXPIRED), META_REPORT_STATES.TOKEN_EXPIRED);
    assert.equal(toMetaReportStatus(META_AUTH_STATES.META_CONFIG_MISSING), META_REPORT_STATES.MISSING_CONFIGURATION);
    assert.equal(toMetaReportStatus(META_AUTH_STATES.META_SSM_ACCESS_DENIED), META_REPORT_STATES.SSM_ACCESS_DENIED);
    assert.equal(toMetaReportStatus(META_AUTH_STATES.META_INSTAGRAM_MISMATCH), META_REPORT_STATES.INSTAGRAM_NOT_LINKED);
  });

  it('validateMetaCredentials reports SSM_ACCESS_DENIED', async () => {
    const v = await validateMetaCredentials({
      pageToken: '',
      pageId: GTM_PAGE_ID,
      igUserId: GTM_IG_BUSINESS_ID,
      ssmAccessDenied: true
    });
    assert.equal(v.ok, false);
    assert.equal(v.reportStatus, 'SSM_ACCESS_DENIED');
    assert.equal(v.ownerActionRequired, true);
  });

  it('validateMetaCredentials reports MISSING_CONFIGURATION without token', async () => {
    const v = await validateMetaCredentials({
      pageToken: '',
      pageId: GTM_PAGE_ID,
      igUserId: GTM_IG_BUSINESS_ID
    });
    assert.equal(v.reportStatus, 'MISSING_CONFIGURATION');
    assert.equal(v.ownerActionRequired, true);
  });
});

