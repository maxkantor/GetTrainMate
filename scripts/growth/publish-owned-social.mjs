#!/usr/bin/env node
/**
 * Publish one weekday owned-social pair (Facebook + Instagram) when Meta credentials are valid.
 * Draft-only is not distribution. Does not print tokens.
 *
 *   node scripts/growth/publish-owned-social.mjs
 *   node scripts/growth/publish-owned-social.mjs --dry-run
 */
import { loadSsmSecretsIntoEnv } from './load-ssm-secrets-into-env.mjs';
import {
  easternIsoDate,
  easternWeekday,
  renderCopy,
  selectCatalogItem,
  trackedUrl
} from './lib/owned-social-catalog.mjs';
import {
  diagnoseMetaBlocker,
  publishFacebookPagePost,
  publishInstagramMedia,
  resolveMetaCredentials
} from './lib/meta-graph.mjs';
import { appendPublishedLog, readPublishedLog, recentlyUsedContentIds } from './lib/owned-social-log.mjs';

function parseArgs(argv) {
  const out = { dryRun: false, skipFacebook: false, skipInstagram: false };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    if (a === '--skip-facebook') out.skipFacebook = true;
    if (a === '--skip-instagram') out.skipInstagram = true;
  }
  return out;
}

function emptyNetwork(network, extra = {}) {
  return {
    network,
    published: false,
    postId: '',
    campaign: '',
    mode: '',
    language: '',
    attributedVisits: 'Unavailable until post is live',
    completedProfiles: 'Unavailable',
    matches: 'Unavailable',
    customers: '0',
    ...extra
  };
}

async function main() {
  loadSsmSecretsIntoEnv();
  const args = parseArgs(process.argv.slice(2));
  const now = new Date();
  const weekday = easternWeekday(now);
  const isoDate = easternIsoDate(now).replace(/-/g, '');
  const isoHyphen = easternIsoDate(now);
  const log = readPublishedLog();
  const item = selectCatalogItem({
    weekday,
    recentlyUsedIds: recentlyUsedContentIds(log)
  });

  const creds = resolveMetaCredentials();
  const connectorBlocker = diagnoseMetaBlocker(creds);

  const facebookUrl = trackedUrl({
    network: 'facebook',
    mode: item.mode,
    language: item.language,
    contentId: item.contentId,
    landingPath: item.landingPath,
    isoDate
  });
  const instagramUrl = trackedUrl({
    network: 'instagram',
    mode: item.mode,
    language: item.language,
    contentId: item.contentId,
    landingPath: item.landingPath,
    isoDate
  });
  const facebookCopy = renderCopy(item.facebook, facebookUrl);
  const instagramCopy = renderCopy(item.instagram, instagramUrl);

  const report = {
    generatedAtUtc: now.toISOString(),
    isoDate: isoHyphen,
    weekday,
    contentId: item.contentId,
    mode: item.mode,
    language: item.language,
    kind: item.kind,
    connectorHealthy: !connectorBlocker,
    connectorBlocker,
    facebook: emptyNetwork('facebook', {
      campaign: `owned-facebook-${item.mode.toLowerCase()}-${item.language}-${isoDate}`,
      mode: item.mode,
      language: item.language
    }),
    instagram: emptyNetwork('instagram', {
      campaign: `owned-instagram-${item.mode.toLowerCase()}-${item.language}-${isoDate}`,
      mode: item.mode,
      language: item.language
    })
  };

  if (args.dryRun) {
    report.dryRun = true;
    report.facebook.draft = facebookCopy;
    report.instagram.draft = instagramCopy;
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  if (connectorBlocker) {
    report.facebook.blocker = connectorBlocker;
    report.instagram.blocker = connectorBlocker;
    appendPublishedLog({
      publishedAtUtc: now.toISOString(),
      contentId: item.contentId,
      mode: item.mode,
      language: item.language,
      status: 'blocked',
      blocker: connectorBlocker
    });
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = 2;
    return;
  }

  if (!args.skipFacebook) {
    const fb = await publishFacebookPagePost({
      pageId: creds.pageId,
      pageToken: creds.pageToken,
      message: facebookCopy,
      link: facebookUrl
    });
    report.facebook.published = Boolean(fb.ok);
    report.facebook.postId = fb.postId || '';
    report.facebook.postUrl = fb.postUrl || '';
    report.facebook.blocker = fb.ok ? '' : fb.blocker;
  } else {
    report.facebook.blocker = 'skipped';
  }

  if (!args.skipInstagram) {
    const ig = await publishInstagramMedia({
      igUserId: creds.igUserId,
      pageToken: creds.pageToken,
      caption: instagramCopy,
      imageUrl: item.imageUrl
    });
    report.instagram.published = Boolean(ig.ok);
    report.instagram.postId = ig.postId || '';
    report.instagram.postUrl = ig.postUrl || '';
    report.instagram.blocker = ig.ok ? '' : ig.blocker;
  } else {
    report.instagram.blocker = 'skipped';
  }

  const anyPublished = report.facebook.published || report.instagram.published;
  appendPublishedLog({
    publishedAtUtc: now.toISOString(),
    contentId: item.contentId,
    mode: item.mode,
    language: item.language,
    status: anyPublished ? 'published' : 'failed',
    facebookPostId: report.facebook.postId,
    instagramPostId: report.instagram.postId,
    blocker: report.facebook.blocker || report.instagram.blocker || ''
  });

  console.log(JSON.stringify(report, null, 2));
  if (!anyPublished) process.exitCode = 2;
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
  process.exit(1);
});
