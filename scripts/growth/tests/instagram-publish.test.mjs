import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  INSTAGRAM_PUBLISH_STATES,
  classifyInstagramPublishError,
  publishInstagramMedia,
  waitForInstagramContainerReady
} from '../lib/meta-graph.mjs';
import { composeGrowthEmailBody, defaultDecision } from '../lib/growth-report.mjs';

describe('instagram publish error classification', () => {
  it('maps 9007 / 2207027 to INSTAGRAM_MEDIA_ID_UNAVAILABLE not META_AUTH', () => {
    const state = classifyInstagramPublishError({
      code: 9007,
      subcode: 2207027,
      message: 'Media ID is not available'
    });
    assert.equal(state, INSTAGRAM_PUBLISH_STATES.INSTAGRAM_MEDIA_ID_UNAVAILABLE);
    assert.doesNotMatch(state, /META_AUTH/);
  });
});

describe('instagram container polling', () => {
  it('waits through IN_PROGRESS then FINISHED', async () => {
    let calls = 0;
    const fetchImpl = async (url) => {
      if (String(url).includes('CREATION1')) {
        calls += 1;
        const status_code = calls < 2 ? 'IN_PROGRESS' : 'FINISHED';
        return { ok: true, json: async () => ({ id: 'CREATION1', status_code }) };
      }
      return { ok: false, json: async () => ({}) };
    };
    const ready = await waitForInstagramContainerReady({
      igCreationId: 'CREATION1',
      pageToken: 'TOKEN',
      fetchImpl,
      delayFn: async () => {},
      initialDelayMs: 0,
      pollIntervalMs: 0,
      maxWaitMs: 1000
    });
    assert.equal(ready.ok, true);
    assert.equal(ready.statusCode, 'FINISHED');
    assert.ok(calls >= 2);
  });

  it('times out while IN_PROGRESS', async () => {
    const fetchImpl = async () => ({
      ok: true,
      json: async () => ({ id: 'CREATION1', status_code: 'IN_PROGRESS' })
    });
    const ready = await waitForInstagramContainerReady({
      igCreationId: 'CREATION1',
      pageToken: 'TOKEN',
      fetchImpl,
      delayFn: async () => {},
      initialDelayMs: 0,
      pollIntervalMs: 0,
      maxWaitMs: 0
    });
    assert.equal(ready.ok, false);
    assert.equal(ready.state, INSTAGRAM_PUBLISH_STATES.INSTAGRAM_MEDIA_PROCESSING_TIMEOUT);
  });
});

describe('publishInstagramMedia lifecycle', () => {
  it('create → FINISHED → publish returns igPublishedMediaId', async () => {
    const fetchImpl = async (url, opts = {}) => {
      const u = String(url);
      if (opts.method === 'HEAD') {
        return {
          ok: true,
          status: 200,
          headers: { get: (k) => (k === 'content-type' ? 'image/jpeg' : k === 'content-length' ? '5000' : null) }
        };
      }
      if (opts.method === 'POST' && u.includes('/media_publish')) {
        return { ok: true, status: 200, json: async () => ({ id: 'PUBLISHED99' }) };
      }
      if (opts.method === 'POST' && u.includes('/media')) {
        return { ok: true, status: 200, json: async () => ({ id: 'CREATION42' }) };
      }
      if (u.includes('CREATION42')) {
        return { ok: true, status: 200, json: async () => ({ id: 'CREATION42', status_code: 'FINISHED' }) };
      }
      return { ok: false, status: 500, json: async () => ({}) };
    };
    const result = await publishInstagramMedia({
      igUserId: '17841434503711452',
      pageToken: 'TOKEN',
      caption: 'hi',
      imageUrl: 'https://gettrainmate.com/images/og-image.jpg',
      fetchImpl,
      delayFn: async () => {},
      initialDelayMs: 0,
      pollIntervalMs: 0,
      maxWaitMs: 1000
    });
    assert.equal(result.ok, true);
    assert.equal(result.igCreationId, 'CREATION42');
    assert.equal(result.igPublishedMediaId, 'PUBLISHED99');
    assert.equal(result.state, INSTAGRAM_PUBLISH_STATES.INSTAGRAM_MEDIA_PUBLISHED);
    assert.doesNotMatch(JSON.stringify(result), /TOKEN|access_token/);
  });

  it('reports 9007 on publish without calling it META_AUTH', async () => {
    const fetchImpl = async (url, opts = {}) => {
      const u = String(url);
      if (opts.method === 'HEAD') {
        return {
          ok: true,
          status: 200,
          headers: { get: (k) => (k === 'content-type' ? 'image/jpeg' : '5000') }
        };
      }
      if (opts.method === 'POST' && u.includes('/media_publish')) {
        return {
          ok: false,
          status: 400,
          json: async () => ({
            error: { message: 'Media ID is not available', code: 9007, error_subcode: 2207027 }
          })
        };
      }
      if (opts.method === 'POST' && u.includes('/media')) {
        return { ok: true, status: 200, json: async () => ({ id: 'CREATION42' }) };
      }
      if (u.includes('CREATION42')) {
        return { ok: true, status: 200, json: async () => ({ id: 'CREATION42', status_code: 'FINISHED' }) };
      }
      return { ok: false, status: 500, json: async () => ({}) };
    };
    const result = await publishInstagramMedia({
      igUserId: '17841434503711452',
      pageToken: 'TOKEN',
      caption: 'hi',
      imageUrl: 'https://gettrainmate.com/images/og-image.jpg',
      fetchImpl,
      delayFn: async () => {},
      skipImageCheck: true,
      initialDelayMs: 0,
      pollIntervalMs: 0,
      maxWaitMs: 1000
    });
    assert.equal(result.ok, false);
    assert.equal(result.state, INSTAGRAM_PUBLISH_STATES.INSTAGRAM_MEDIA_ID_UNAVAILABLE);
    assert.match(result.blocker, /INSTAGRAM_MEDIA_ID_UNAVAILABLE/);
    assert.doesNotMatch(result.blocker, /META_AUTH_UNKNOWN/);
  });

  it('fails when creation id missing', async () => {
    const fetchImpl = async (_url, opts = {}) => {
      if (opts.method === 'HEAD') {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'image/jpeg' }
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };
    const result = await publishInstagramMedia({
      igUserId: '1',
      pageToken: 'TOKEN',
      caption: 'x',
      imageUrl: 'https://gettrainmate.com/images/og-image.jpg',
      fetchImpl,
      skipImageCheck: true
    });
    assert.equal(result.ok, false);
    assert.equal(result.state, INSTAGRAM_PUBLISH_STATES.INSTAGRAM_CONTAINER_ID_MISSING);
  });
});

describe('report separates Meta auth from Instagram publish failure', () => {
  it('keeps Meta VALID while Instagram FAILED with 9007', () => {
    const decision = defaultDecision({
      health: { ok: true },
      reconciliation: { ok: true },
      snapshot: {
        ownedSocial: {
          metaAuth: { authentication: 'VALID', status: 'META_VALID' },
          facebook: { published: true, postId: '1138684902641972_1' },
          instagram: {
            published: false,
            state: 'INSTAGRAM_MEDIA_ID_UNAVAILABLE',
            blocker: 'Media ID is not available · INSTAGRAM_MEDIA_ID_UNAVAILABLE · code 9007 · subcode 2207027'
          }
        }
      }
    });
    assert.match(decision, /Meta authentication: VALID/);
    assert.match(decision, /Instagram publishing: FAILED/);
    assert.doesNotMatch(decision, /META_AUTH_UNKNOWN/);

    const { text, html } = composeGrowthEmailBody({
      snapshot: {
        sources: { ga4: 'ok', stripe: 'ok' },
        scoreboard: { '7d': {}, '30d': {} },
        reconciliation: { ok: true, warnings: [] },
        ownedSocial: {
          metaAuth: {
            configuration: 'PRESENT',
            authentication: 'VALID',
            status: 'META_VALID',
            facebookPublishing: 'ALLOWED',
            InstagramPublishing: 'ALLOWED'
          },
          facebook: { published: true, postId: '1138684902641972_1' },
          instagram: {
            published: false,
            state: 'INSTAGRAM_MEDIA_ID_UNAVAILABLE',
            blocker: 'Media ID is not available · INSTAGRAM_MEDIA_ID_UNAVAILABLE · code 9007 · subcode 2207027'
          }
        }
      },
      health: { ok: true, checks: [] },
      experiments: [],
      generatedAt: new Date('2026-08-20T15:00:00Z'),
      decision
    });
    assert.match(text, /Meta authentication: VALID/);
    assert.match(text, /Instagram publishing: FAILED/);
    assert.match(text, /INSTAGRAM_MEDIA_ID_UNAVAILABLE/);
    assert.doesNotMatch(html, /Meta status:.*9007/);
  });
});
