/**
 * Meta Graph API for owned Facebook Page + Instagram Business.
 * Never logs, emails, or returns access tokens.
 */
import {
  GRAPH_BASE,
  GTM_IG_BUSINESS_ID,
  GTM_PAGE_ID,
  classifyGraphAuthError,
  parseGraphErrorBody,
  redactSecrets,
  validateMetaCredentials
} from './meta-token.mjs';

const GRAPH = GRAPH_BASE;

export const INSTAGRAM_PUBLISH_STATES = {
  INSTAGRAM_CONTAINER_CREATED: 'INSTAGRAM_CONTAINER_CREATED',
  INSTAGRAM_MEDIA_PROCESSING: 'INSTAGRAM_MEDIA_PROCESSING',
  INSTAGRAM_MEDIA_READY: 'INSTAGRAM_MEDIA_READY',
  INSTAGRAM_MEDIA_PUBLISHED: 'INSTAGRAM_MEDIA_PUBLISHED',
  INSTAGRAM_CONTAINER_ERROR: 'INSTAGRAM_CONTAINER_ERROR',
  INSTAGRAM_MEDIA_PROCESSING_TIMEOUT: 'INSTAGRAM_MEDIA_PROCESSING_TIMEOUT',
  INSTAGRAM_MEDIA_ID_UNAVAILABLE: 'INSTAGRAM_MEDIA_ID_UNAVAILABLE',
  INSTAGRAM_PUBLISH_FAILED: 'INSTAGRAM_PUBLISH_FAILED',
  INSTAGRAM_GRAPH_UNAVAILABLE: 'INSTAGRAM_GRAPH_UNAVAILABLE',
  INSTAGRAM_INVALID_MEDIA_URL: 'INSTAGRAM_INVALID_MEDIA_URL',
  INSTAGRAM_CONTAINER_ID_MISSING: 'INSTAGRAM_CONTAINER_ID_MISSING'
};

function redact(err) {
  return redactSecrets(err instanceof Error ? err.message : String(err || ''));
}

function sleep(ms, delayFn = (n) => new Promise((r) => setTimeout(r, n))) {
  return delayFn(ms);
}

function facebookGraphError(body, fallback) {
  const parsed = parseGraphErrorBody(body);
  const state = classifyGraphAuthError(parsed);
  const msg = parsed.message || fallback;
  const parts = [msg, state];
  if (parsed.code != null) parts.push(`code ${parsed.code}`);
  if (parsed.subcode != null) parts.push(`subcode ${parsed.subcode}`);
  return parts.join(' · ');
}

export function classifyInstagramPublishError({ code, subcode, message, stage } = {}) {
  const c = Number(code);
  const sc = Number(subcode);
  const msg = String(message || '').toLowerCase();

  if (c === 190) return classifyGraphAuthError({ code, subcode, message });
  if (c === 9007 || sc === 2207027 || msg.includes('media id is not available') || msg.includes('not ready for publishing')) {
    return INSTAGRAM_PUBLISH_STATES.INSTAGRAM_MEDIA_ID_UNAVAILABLE;
  }
  if (stage === 'create' && (msg.includes('image') || msg.includes('url') || c === 36003 || sc === 2207004)) {
    return INSTAGRAM_PUBLISH_STATES.INSTAGRAM_INVALID_MEDIA_URL;
  }
  if (stage === 'status' && (msg.includes('error') || msg.includes('failed'))) {
    return INSTAGRAM_PUBLISH_STATES.INSTAGRAM_CONTAINER_ERROR;
  }
  if (!Number.isFinite(c) && (msg.includes('fetch failed') || msg.includes('network') || msg.includes('enotfound'))) {
    return INSTAGRAM_PUBLISH_STATES.INSTAGRAM_GRAPH_UNAVAILABLE;
  }
  return INSTAGRAM_PUBLISH_STATES.INSTAGRAM_PUBLISH_FAILED;
}

function instagramGraphError(body, fallback, stage) {
  const parsed = parseGraphErrorBody(body);
  const state = classifyInstagramPublishError({ ...parsed, stage });
  const msg = parsed.message || fallback;
  const parts = [msg, state];
  if (parsed.code != null) parts.push(`code ${parsed.code}`);
  if (parsed.subcode != null) parts.push(`subcode ${parsed.subcode}`);
  return { blocker: parts.join(' · '), state, graph: parsed };
}

export function resolveMetaCredentials(env = process.env) {
  const pageToken = (
    env.META_PAGE_ACCESS_TOKEN ||
    env.FACEBOOK_PAGE_ACCESS_TOKEN ||
    env.INSTAGRAM_GRAPH_ACCESS_TOKEN ||
    ''
  ).trim();
  const pageId = (env.FACEBOOK_PAGE_ID || env.META_FACEBOOK_PAGE_ID || GTM_PAGE_ID || '').trim();
  const igUserId = (
    env.INSTAGRAM_BUSINESS_ACCOUNT_ID ||
    env.META_INSTAGRAM_BUSINESS_ACCOUNT_ID ||
    GTM_IG_BUSINESS_ID ||
    ''
  ).trim();
  return { pageToken, pageId, igUserId };
}

/** Config-only check (does not call Graph). Prefer validateMetaCredentials before publish. */
export function diagnoseMetaBlocker({ pageToken, pageId, igUserId }) {
  if (!pageToken) {
    return (
      'Meta Page access token missing. Set SSM /gettrainmate/growth/meta-page-access-token ' +
      '(or env META_PAGE_ACCESS_TOKEN). Run: node scripts/growth/setup-meta-token.mjs'
    );
  }
  if (!pageId && !igUserId) {
    return (
      'Meta destination ids missing. Set SSM /gettrainmate/growth/facebook-page-id and ' +
      '/gettrainmate/growth/instagram-business-account-id (Facebook Page id + IG professional account id).'
    );
  }
  return null;
}

async function graphPost(path, params, fetchImpl = fetch) {
  const body = new URLSearchParams(params);
  const res = await fetchImpl(`${GRAPH}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

async function graphGet(path, pageToken, fetchImpl = fetch) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${GRAPH}${path}${sep}access_token=${encodeURIComponent(pageToken)}`;
  const res = await fetchImpl(url, { method: 'GET' });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok && !json.error, status: res.status, json };
}

/**
 * Lightweight public image check for Instagram image_url (no secrets logged).
 */
export async function validatePublicImageUrl(imageUrl, { fetchImpl = fetch } = {}) {
  let host = '';
  try {
    const u = new URL(imageUrl);
    host = u.host;
    if (u.protocol !== 'https:') {
      return { ok: false, state: INSTAGRAM_PUBLISH_STATES.INSTAGRAM_INVALID_MEDIA_URL, host, httpStatus: null, contentType: null, reason: 'not_https' };
    }
    if (/^(localhost|127\.|10\.|192\.168\.|0\.0\.0\.0)/i.test(u.hostname)) {
      return { ok: false, state: INSTAGRAM_PUBLISH_STATES.INSTAGRAM_INVALID_MEDIA_URL, host, httpStatus: null, contentType: null, reason: 'private_host' };
    }
  } catch {
    return { ok: false, state: INSTAGRAM_PUBLISH_STATES.INSTAGRAM_INVALID_MEDIA_URL, host: '', httpStatus: null, contentType: null, reason: 'bad_url' };
  }

  try {
    const res = await fetchImpl(imageUrl, { method: 'HEAD' });
    const contentType = res.headers.get('content-type') || '';
    const len = Number(res.headers.get('content-length') || 0);
    if (!res.ok) {
      return { ok: false, state: INSTAGRAM_PUBLISH_STATES.INSTAGRAM_INVALID_MEDIA_URL, host, httpStatus: res.status, contentType, reason: 'http_not_ok' };
    }
    if (!/^image\/(jpeg|jpg|png)/i.test(contentType)) {
      return { ok: false, state: INSTAGRAM_PUBLISH_STATES.INSTAGRAM_INVALID_MEDIA_URL, host, httpStatus: res.status, contentType, reason: 'bad_content_type' };
    }
    if (Number.isFinite(len) && len > 0 && len < 100) {
      return { ok: false, state: INSTAGRAM_PUBLISH_STATES.INSTAGRAM_INVALID_MEDIA_URL, host, httpStatus: res.status, contentType, reason: 'file_too_small' };
    }
    return { ok: true, host, httpStatus: res.status, contentType, contentLength: len || null };
  } catch (e) {
    return {
      ok: false,
      state: INSTAGRAM_PUBLISH_STATES.INSTAGRAM_GRAPH_UNAVAILABLE,
      host,
      httpStatus: null,
      contentType: null,
      reason: redact(e)
    };
  }
}

/**
 * Poll GET /{igCreationId}?fields=status_code until FINISHED or terminal.
 * Meta: FINISHED | IN_PROGRESS | ERROR | EXPIRED | PUBLISHED
 */
export async function waitForInstagramContainerReady({
  igCreationId,
  pageToken,
  fetchImpl = fetch,
  delayFn,
  initialDelayMs = 2000,
  pollIntervalMs = 3000,
  maxWaitMs = 60000
} = {}) {
  const started = Date.now();
  let attempt = 0;
  let lastStatus = null;

  if (initialDelayMs > 0) await sleep(initialDelayMs, delayFn);

  while (Date.now() - started <= maxWaitMs) {
    attempt += 1;
    const { ok, status, json } = await graphGet(
      `/${encodeURIComponent(igCreationId)}?fields=id,status_code,status`,
      pageToken,
      fetchImpl
    );
    if (!ok) {
      const err = instagramGraphError(json, `Instagram container status failed (${status})`, 'status');
      return {
        ok: false,
        state: err.state,
        statusCode: json?.status_code || null,
        attempt,
        elapsedMs: Date.now() - started,
        httpStatus: status,
        blocker: err.blocker,
        graph: err.graph
      };
    }
    lastStatus = String(json.status_code || '').toUpperCase();
    if (lastStatus === 'FINISHED' || lastStatus === 'PUBLISHED') {
      return {
        ok: true,
        state: INSTAGRAM_PUBLISH_STATES.INSTAGRAM_MEDIA_READY,
        statusCode: lastStatus,
        attempt,
        elapsedMs: Date.now() - started
      };
    }
    if (lastStatus === 'ERROR' || lastStatus === 'EXPIRED') {
      return {
        ok: false,
        state: INSTAGRAM_PUBLISH_STATES.INSTAGRAM_CONTAINER_ERROR,
        statusCode: lastStatus,
        attempt,
        elapsedMs: Date.now() - started,
        blocker: `Instagram container status ${lastStatus} · ${INSTAGRAM_PUBLISH_STATES.INSTAGRAM_CONTAINER_ERROR}`
      };
    }
    // IN_PROGRESS or unknown — keep polling
    if (Date.now() - started + pollIntervalMs > maxWaitMs) break;
    await sleep(pollIntervalMs, delayFn);
  }

  return {
    ok: false,
    state: INSTAGRAM_PUBLISH_STATES.INSTAGRAM_MEDIA_PROCESSING_TIMEOUT,
    statusCode: lastStatus,
    attempt,
    elapsedMs: Date.now() - started,
    blocker: `Instagram media still processing after ${maxWaitMs}ms · ${INSTAGRAM_PUBLISH_STATES.INSTAGRAM_MEDIA_PROCESSING_TIMEOUT}`
  };
}

export async function publishFacebookPagePost({ pageId, pageToken, message, link, fetchImpl = fetch }) {
  if (!pageId) {
    return { ok: false, network: 'facebook', blocker: 'FACEBOOK_PAGE_ID is not configured' };
  }
  const params = { message, access_token: pageToken };
  if (link) params.link = link;
  const { ok, status, json } = await graphPost(`/${pageId}/feed`, params, fetchImpl);
  if (!ok) {
    return {
      ok: false,
      network: 'facebook',
      httpStatus: status,
      authState: classifyGraphAuthError(parseGraphErrorBody(json)),
      blocker: facebookGraphError(json, `Facebook Page feed failed (${status})`)
    };
  }
  const postId = json.id || json.post_id || '';
  return {
    ok: true,
    network: 'facebook',
    postId,
    postUrl: postId ? `https://www.facebook.com/${postId}` : 'https://www.facebook.com/gettrainmate'
  };
}

/**
 * Instagram: create container → poll status → media_publish.
 * Variables: igCreationId (container), igPublishedMediaId (live media).
 */
export async function publishInstagramMedia({
  igUserId,
  pageToken,
  caption,
  imageUrl,
  fetchImpl = fetch,
  delayFn,
  skipImageCheck = false,
  initialDelayMs = 2000,
  pollIntervalMs = 3000,
  maxWaitMs = 60000
} = {}) {
  if (!igUserId) {
    return { ok: false, network: 'instagram', blocker: 'INSTAGRAM_BUSINESS_ACCOUNT_ID is not configured' };
  }
  if (!imageUrl) {
    return {
      ok: false,
      network: 'instagram',
      state: INSTAGRAM_PUBLISH_STATES.INSTAGRAM_INVALID_MEDIA_URL,
      failureStage: 'A',
      blocker: 'Instagram Graph feed posts require a public HTTPS image_url'
    };
  }

  if (!skipImageCheck) {
    const mediaCheck = await validatePublicImageUrl(imageUrl, { fetchImpl });
    if (!mediaCheck.ok) {
      return {
        ok: false,
        network: 'instagram',
        state: mediaCheck.state || INSTAGRAM_PUBLISH_STATES.INSTAGRAM_INVALID_MEDIA_URL,
        failureStage: 'A',
        mediaUrlReachable: false,
        mediaHttpStatus: mediaCheck.httpStatus,
        mediaContentType: mediaCheck.contentType,
        mediaHost: mediaCheck.host,
        blocker: `Instagram image_url not usable (${mediaCheck.reason}) · ${mediaCheck.state}`
      };
    }
  }

  const create = await graphPost(
    `/${igUserId}/media`,
    {
      caption,
      image_url: imageUrl,
      access_token: pageToken
    },
    fetchImpl
  );
  const igCreationId = create.json?.id ? String(create.json.id) : '';
  if (!create.ok || !igCreationId) {
    const err = instagramGraphError(create.json, `Instagram media create failed (${create.status})`, 'create');
    return {
      ok: false,
      network: 'instagram',
      httpStatus: create.status,
      state: igCreationId ? err.state : INSTAGRAM_PUBLISH_STATES.INSTAGRAM_CONTAINER_ID_MISSING,
      failureStage: 'A',
      igCreationId: igCreationId || '',
      creationIdReceived: Boolean(igCreationId),
      blocker: err.blocker
    };
  }

  const ready = await waitForInstagramContainerReady({
    igCreationId,
    pageToken,
    fetchImpl,
    delayFn,
    initialDelayMs,
    pollIntervalMs,
    maxWaitMs
  });
  if (!ready.ok) {
    return {
      ok: false,
      network: 'instagram',
      state: ready.state,
      failureStage: ready.state === INSTAGRAM_PUBLISH_STATES.INSTAGRAM_MEDIA_PROCESSING_TIMEOUT ? 'B' : 'C',
      igCreationId,
      creationIdReceived: true,
      containerStatus: ready.statusCode,
      attempt: ready.attempt,
      elapsedMs: ready.elapsedMs,
      blocker: ready.blocker
    };
  }

  let publish = await graphPost(
    `/${igUserId}/media_publish`,
    {
      creation_id: igCreationId,
      access_token: pageToken
    },
    fetchImpl
  );

  // One safe retry on same container if Meta still returns 9007 after FINISHED.
  if (!publish.ok) {
    const parsed = parseGraphErrorBody(publish.json);
    if (Number(parsed.code) === 9007 || Number(parsed.subcode) === 2207027) {
      await sleep(pollIntervalMs, delayFn);
      publish = await graphPost(
        `/${igUserId}/media_publish`,
        {
          creation_id: igCreationId,
          access_token: pageToken
        },
        fetchImpl
      );
    }
  }

  if (!publish.ok) {
    const err = instagramGraphError(publish.json, `Instagram media_publish failed (${publish.status})`, 'publish');
    return {
      ok: false,
      network: 'instagram',
      httpStatus: publish.status,
      state: err.state,
      failureStage: 'D',
      igCreationId,
      creationIdReceived: true,
      containerStatus: ready.statusCode,
      attempt: ready.attempt,
      elapsedMs: ready.elapsedMs,
      blocker: err.blocker,
      graph: err.graph
    };
  }

  const igPublishedMediaId = publish.json.id ? String(publish.json.id) : '';
  if (!igPublishedMediaId) {
    return {
      ok: false,
      network: 'instagram',
      state: INSTAGRAM_PUBLISH_STATES.INSTAGRAM_PUBLISH_FAILED,
      failureStage: 'E',
      igCreationId,
      creationIdReceived: true,
      containerStatus: ready.statusCode,
      blocker: `Instagram publish returned no media id · ${INSTAGRAM_PUBLISH_STATES.INSTAGRAM_PUBLISH_FAILED}`
    };
  }

  return {
    ok: true,
    network: 'instagram',
    state: INSTAGRAM_PUBLISH_STATES.INSTAGRAM_MEDIA_PUBLISHED,
    failureStage: null,
    igCreationId,
    igPublishedMediaId,
    postId: igPublishedMediaId,
    creationId: igCreationId,
    containerStatus: ready.statusCode,
    attempt: ready.attempt,
    elapsedMs: ready.elapsedMs,
    postUrl: 'https://www.instagram.com/gettrainmate/'
  };
}

export { redact, validateMetaCredentials, classifyGraphAuthError, parseGraphErrorBody };
