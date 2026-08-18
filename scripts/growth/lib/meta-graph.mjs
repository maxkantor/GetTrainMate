/**
 * Meta Graph API for owned Facebook Page + Instagram Business.
 * Never logs, emails, or returns access tokens.
 */
const GRAPH = 'https://graph.facebook.com/v21.0';

function redact(err) {
  const raw = err instanceof Error ? err.message : String(err || '');
  return raw.replace(/access_token=[^&\s]+/gi, 'access_token=REDACTED').replace(/sk_[A-Za-z0-9]+/g, 'REDACTED');
}

function graphError(body, fallback) {
  const msg = body?.error?.message || body?.error?.error_user_msg || fallback;
  const code = body?.error?.code;
  const sub = body?.error?.error_subcode;
  const parts = [msg];
  if (code != null) parts.push(`code ${code}`);
  if (sub != null) parts.push(`subcode ${sub}`);
  return parts.join(' · ');
}

export function resolveMetaCredentials(env = process.env) {
  const pageToken = (
    env.META_PAGE_ACCESS_TOKEN ||
    env.FACEBOOK_PAGE_ACCESS_TOKEN ||
    env.INSTAGRAM_GRAPH_ACCESS_TOKEN ||
    ''
  ).trim();
  const pageId = (env.FACEBOOK_PAGE_ID || env.META_FACEBOOK_PAGE_ID || '').trim();
  const igUserId = (env.INSTAGRAM_BUSINESS_ACCOUNT_ID || env.META_INSTAGRAM_BUSINESS_ACCOUNT_ID || '').trim();
  return { pageToken, pageId, igUserId };
}

export function diagnoseMetaBlocker({ pageToken, pageId, igUserId }) {
  if (!pageToken) {
    return (
      'Meta Page access token missing. Set SSM /gettrainmate/growth/meta-page-access-token ' +
      '(or env META_PAGE_ACCESS_TOKEN / INSTAGRAM_GRAPH_ACCESS_TOKEN). Token must be a Page token with ' +
      'pages_manage_posts, pages_read_engagement, instagram_content_publish, instagram_basic.'
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

async function graphPost(path, params) {
  const body = new URLSearchParams(params);
  const res = await fetch(`${GRAPH}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

export async function publishFacebookPagePost({ pageId, pageToken, message, link }) {
  if (!pageId) {
    return { ok: false, network: 'facebook', blocker: 'FACEBOOK_PAGE_ID is not configured' };
  }
  const params = { message, access_token: pageToken };
  if (link) params.link = link;
  const { ok, status, json } = await graphPost(`/${pageId}/feed`, params);
  if (!ok) {
    return {
      ok: false,
      network: 'facebook',
      httpStatus: status,
      blocker: graphError(json, `Facebook Page feed failed (${status})`)
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

export async function publishInstagramMedia({ igUserId, pageToken, caption, imageUrl }) {
  if (!igUserId) {
    return { ok: false, network: 'instagram', blocker: 'INSTAGRAM_BUSINESS_ACCOUNT_ID is not configured' };
  }
  if (!imageUrl) {
    return {
      ok: false,
      network: 'instagram',
      blocker: 'Instagram Graph feed posts require a public HTTPS image_url'
    };
  }
  const create = await graphPost(`/${igUserId}/media`, {
    caption,
    image_url: imageUrl,
    access_token: pageToken
  });
  if (!create.ok || !create.json.id) {
    return {
      ok: false,
      network: 'instagram',
      httpStatus: create.status,
      blocker: graphError(create.json, `Instagram media create failed (${create.status})`)
    };
  }
  const publish = await graphPost(`/${igUserId}/media_publish`, {
    creation_id: create.json.id,
    access_token: pageToken
  });
  if (!publish.ok) {
    return {
      ok: false,
      network: 'instagram',
      httpStatus: publish.status,
      blocker: graphError(publish.json, `Instagram media_publish failed (${publish.status})`)
    };
  }
  const mediaId = publish.json.id || '';
  return {
    ok: true,
    network: 'instagram',
    postId: mediaId,
    creationId: create.json.id,
    postUrl: 'https://www.instagram.com/gettrainmate/'
  };
}

export { redact };
