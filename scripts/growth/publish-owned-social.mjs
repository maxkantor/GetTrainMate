#!/usr/bin/env node
/**
 * Publish one weekday owned-social pair (Facebook + Instagram) when Meta credentials are valid.
 * Draft-only is not distribution. Does not print tokens.
 *
 *   node scripts/growth/publish-owned-social.mjs
 *   node scripts/growth/publish-owned-social.mjs --dry-run
 */
import { loadSsmSecretsIntoEnv } from './load-ssm-secrets-into-env.mjs';
import { ensureGrowthDeps } from './lib/ensure-growth-deps.mjs';
import {
  easternIsoDate,
  easternWeekday,
  findCatalogItemByContentId,
  renderFacebookCopy,
  renderInstagramCopy,
  selectCatalogItem,
  shortTrackedUrl,
  trackedUrl
} from './lib/owned-social-catalog.mjs';
import {
  diagnoseMetaBlocker,
  publishFacebookPagePhoto,
  publishInstagramMedia,
  resolveMetaCredentials,
  validateMetaCredentials
} from './lib/meta-graph.mjs';
import { META_AUTH_STATES, ownerSetupInstructions } from './lib/meta-token.mjs';
import { appendPublishedLog, readPublishedLog, recentlyUsedContentIds } from './lib/owned-social-log.mjs';
import { loadRecentImageHistory } from './lib/social-image-history.mjs';
import { generateSocialImage } from './lib/social-image-generator.mjs';
import { logSocialImageEvent } from './lib/social-image-logger.mjs';
import { purgeOldSocialImages } from './lib/social-image-purge.mjs';

function parseArgs(argv) {
  const out = { dryRun: false, skipFacebook: false, skipInstagram: false, contentId: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    if (a === '--skip-facebook') out.skipFacebook = true;
    if (a === '--skip-instagram') out.skipInstagram = true;
    if (a === '--content-id') out.contentId = argv[++i] || null;
  }
  return out;
}

function alreadyHasInstagramMedia(log, contentId) {
  return (log.entries || []).some(
    (e) => e.contentId === contentId && e.instagramPostId && String(e.instagramPostId).trim() !== ''
  );
}

function priorFacebookPostId(log, contentId) {
  const hits = (log.entries || []).filter((e) => e.contentId === contentId && e.facebookPostId);
  return hits.length ? hits[hits.length - 1].facebookPostId : '';
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
  const deps = await ensureGrowthDeps();
  if (!deps.ok) {
    console.error(JSON.stringify({ ok: false, error: 'growth_deps_missing', detail: deps.error }));
    process.exit(2);
  }
  const args = parseArgs(process.argv.slice(2));
  const now = new Date();
  const weekday = easternWeekday(now);
  const isoDate = easternIsoDate(now).replace(/-/g, '');
  const isoHyphen = easternIsoDate(now);
  const log = readPublishedLog();
  let item;
  if (args.contentId) {
    item = findCatalogItemByContentId(args.contentId);
    if (!item) {
      console.error(JSON.stringify({ ok: false, error: 'unknown_content_id', contentId: args.contentId }));
      process.exit(2);
    }
  } else {
    item = selectCatalogItem({
      weekday,
      recentlyUsedIds: recentlyUsedContentIds(log),
      isoDate: isoHyphen
    });
  }

  if (args.skipFacebook && !args.skipInstagram && alreadyHasInstagramMedia(log, item.contentId)) {
    console.log(
      JSON.stringify({
        ok: true,
        skipped: true,
        reason: 'instagram_already_published_for_content',
        contentId: item.contentId
      })
    );
    return;
  }

  const creds = resolveMetaCredentials();
  const configBlocker = diagnoseMetaBlocker(creds);
  let validation = null;
  if (!configBlocker && !args.dryRun) {
    validation = await validateMetaCredentials({
      pageToken: creds.pageToken,
      pageId: creds.pageId,
      igUserId: creds.igUserId,
      appId: process.env.META_APP_ID || '',
      appSecret: process.env.META_APP_SECRET || ''
    });
  }
  const connectorBlocker = configBlocker
    ? configBlocker
    : validation && !validation.ok
      ? `${validation.state}: ${validation.graph?.message || 'Meta authentication invalid'}${validation.ownerActionRequired ? ` · ${ownerSetupInstructions().split('\n')[0]}` : ''}`
      : null;

  const facebookUrl = trackedUrl({
    network: 'facebook',
    mode: item.mode,
    language: item.language,
    contentId: item.contentId,
    landingPath: item.landingPath,
    isoDate,
    market: item.market
  });
  const facebookShortUrl = shortTrackedUrl({
    network: 'facebook',
    mode: item.mode,
    language: item.language,
    contentId: item.contentId,
    landingPath: item.landingPath,
    isoDate,
    market: item.market
  });
  const instagramUrl = shortTrackedUrl({
    network: 'instagram',
    mode: item.mode,
    language: item.language,
    contentId: item.contentId,
    landingPath: item.landingPath,
    isoDate,
    market: item.market
  });
  // Facebook + Instagram: publish generated branded image as media (not website OG link preview).
  const facebookCopy = renderFacebookCopy(item.facebook, facebookShortUrl);
  const instagramCopy = renderInstagramCopy(item.instagram, instagramUrl);

  const recentImageEntries = loadRecentImageHistory({ days: 30 });
  if (!args.dryRun) {
    purgeOldSocialImages({ days: Number(process.env.SOCIAL_IMAGE_RETENTION_DAYS || 30) });
  }
  let socialImage;
  try {
    socialImage = await generateSocialImage({
      catalogItem: item,
      isoDate,
      isoHyphen,
      recentImageEntries,
      dryRun: args.dryRun
    });
  } catch (e) {
    console.error(
      JSON.stringify({
        ok: false,
        error: 'social_image_generation_failed',
        detail: e instanceof Error ? e.message : String(e)
      })
    );
    process.exit(2);
  }

  const generatedImageUrl = socialImage.imageUrl || null;
  const publishImageUrl = generatedImageUrl;

  const report = {
    generatedAtUtc: now.toISOString(),
    isoDate: isoHyphen,
    weekday,
    contentId: item.contentId,
    mode: item.mode,
    language: item.language,
    kind: item.kind,
    connectorHealthy: !connectorBlocker && (validation ? validation.ok === true : !configBlocker),
    connectorBlocker,
    metaAuth: validation
      ? {
          configuration: validation.configuration,
          authentication: validation.authentication,
          status: validation.state,
          facebookPublishing: validation.facebookPublishing,
          instagramPublishing: validation.instagramPublishing,
          ownerActionRequired: validation.ownerActionRequired,
          pageId: validation.page?.id || '',
          pageName: validation.page?.name || '',
          instagramId: validation.instagram?.id || '',
          instagramUsername: validation.instagram?.username || '',
          tokenExpires: validation.debug?.expires_at || 'unknown',
          validatedAt: validation.validatedAt || null,
          graphCode: validation.graph?.code ?? null,
          graphSubcode: validation.graph?.subcode ?? null
        }
      : {
          configuration: configBlocker ? 'MISSING' : 'PRESENT',
          authentication: configBlocker ? 'INVALID' : 'UNCHECKED',
          status: configBlocker ? META_AUTH_STATES.META_CONFIG_MISSING : 'DRY_RUN_OR_SKIPPED',
          facebookPublishing: 'BLOCKED',
          instagramPublishing: 'BLOCKED',
          ownerActionRequired: Boolean(configBlocker)
        },
    distributionAttempted: !args.dryRun,
    distributionExecuted: false,
    facebook: emptyNetwork('facebook', {
      campaign: `owned-facebook-${item.mode.toLowerCase()}-${item.language}-${isoDate}`,
      mode: item.mode,
      language: item.language
    }),
    instagram: emptyNetwork('instagram', {
      campaign: `owned-instagram-${item.mode.toLowerCase()}-${item.language}-${isoDate}`,
      mode: item.mode,
      language: item.language
    }),
    socialImage: {
      mode: socialImage.concept?.mode || item.mode,
      imageHeadline: socialImage.concept?.imageHeadline || '',
      imageSubheadline: socialImage.concept?.imageSubheadline || '',
      visualConcept: socialImage.concept?.visualConcept || '',
      cta: socialImage.concept?.cta || '',
      provider: socialImage.provider || 'procedural',
      fallback: Boolean(socialImage.fallback),
      imageKey: socialImage.imageKey || '',
      imageUrl: generatedImageUrl,
      localPath: socialImage.localPath || '',
      width: socialImage.width || 1080,
      height: socialImage.height || 1350,
      durationMs: socialImage.durationMs || null,
      uploadError: socialImage.uploadError || ''
    }
  };

  if (args.dryRun) {
    report.dryRun = true;
    report.facebook.draft = facebookCopy;
    report.instagram.draft = instagramCopy;
    report.facebook.publishType = 'photo';
    report.instagram.imageUrl = publishImageUrl || '(local only — dry run)';
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  if (!publishImageUrl) {
    report.facebook.blocker = socialImage.uploadError || 'social_image_upload_failed';
    report.instagram.blocker = socialImage.uploadError || 'social_image_upload_failed';
    appendPublishedLog({
      publishedAtUtc: now.toISOString(),
      contentId: item.contentId,
      mode: item.mode,
      language: item.language,
      status: 'failed',
      blocker: report.facebook.blocker,
      imageHeadline: socialImage.concept?.imageHeadline,
      visualConcept: socialImage.concept?.visualConcept,
      photoPrompt: socialImage.concept?.photoPrompt || socialImage.concept?.visualConcept,
      imageCta: socialImage.concept?.cta,
      imageSeed: socialImage.concept?.backgroundSeed,
      imageKey: socialImage.imageKey || ''
    });
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = 2;
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
      blocker: connectorBlocker,
      imageHeadline: socialImage.concept?.imageHeadline,
      visualConcept: socialImage.concept?.visualConcept,
      photoPrompt: socialImage.concept?.photoPrompt || socialImage.concept?.visualConcept,
      imageCta: socialImage.concept?.cta,
      imageSeed: socialImage.concept?.backgroundSeed,
      stockPhotoId: socialImage.concept?.stockPhotoId || '',
      imageKey: socialImage.imageKey || '',
      imageUrl: publishImageUrl
    });
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = 2;
    return;
  }

  if (!args.skipFacebook) {
    const fb = await publishFacebookPagePhoto({
      pageId: creds.pageId,
      pageToken: creds.pageToken,
      caption: facebookCopy,
      imageUrl: publishImageUrl
    });
    report.facebook.published = Boolean(fb.ok);
    report.facebook.postId = fb.postId || '';
    report.facebook.postUrl = fb.postUrl || '';
    report.facebook.blocker = fb.ok ? '' : fb.blocker;
    report.facebook.publishType = fb.publishType || 'photo';
    report.facebook.imageUrl = publishImageUrl;
    if (fb.ok) {
      logSocialImageEvent('FacebookImagePostPublished', {
        mode: item.mode,
        postId: fb.postId,
        imageKey: socialImage.imageKey,
        publishType: 'photo'
      });
    }
  } else {
    report.facebook.blocker = 'skipped';
  }

  if (!args.skipInstagram) {
    const ig = await publishInstagramMedia({
      igUserId: creds.igUserId,
      pageToken: creds.pageToken,
      caption: instagramCopy,
      imageUrl: publishImageUrl
    });
    report.instagram.published = Boolean(ig.ok);
    report.instagram.postId = ig.igPublishedMediaId || ig.postId || '';
    report.instagram.postUrl = ig.postUrl || '';
    report.instagram.blocker = ig.ok ? '' : ig.blocker;
    report.instagram.state = ig.state || '';
    report.instagram.igCreationId = ig.igCreationId || '';
    report.instagram.containerStatus = ig.containerStatus || '';
    report.instagram.failureStage = ig.failureStage || null;
    report.instagram.imageUrl = publishImageUrl;
    if (ig.ok) {
      logSocialImageEvent('InstagramImagePostPublished', {
        mode: item.mode,
        postId: ig.postId,
        imageKey: socialImage.imageKey
      });
    }
  } else {
    report.instagram.blocker = 'skipped';
  }

  // Keep Meta auth VALID even when Instagram publish fails for non-auth reasons.
  if (report.metaAuth?.authentication === 'VALID' && report.instagram.blocker && !report.instagram.published) {
    report.instagramPublishFailedWhileAuthValid = true;
  }

  const anyPublished = report.facebook.published || report.instagram.published;
  report.distributionExecuted = anyPublished;
  report.technicalDistributionResult = anyPublished ? 'SUCCEEDED' : 'FAILED';
  appendPublishedLog({
    publishedAtUtc: now.toISOString(),
    contentId: item.contentId,
    mode: item.mode,
    language: item.language,
    status: anyPublished ? 'published' : 'failed',
    facebookPostId: args.skipFacebook
      ? priorFacebookPostId(log, item.contentId)
      : report.facebook.postId,
    instagramPostId: report.instagram.postId,
    igCreationId: report.instagram.igCreationId || '',
    blocker:
      [
        !args.skipFacebook && !report.facebook.published ? report.facebook.blocker : '',
        !args.skipInstagram && !report.instagram.published ? report.instagram.blocker : ''
      ]
        .filter(Boolean)
        .join(' · ') || '',
    metaStatus: report.metaAuth?.status || '',
    instagramState: report.instagram.state || '',
      imageHeadline: socialImage.concept?.imageHeadline,
      visualConcept: socialImage.concept?.visualConcept,
      photoPrompt: socialImage.concept?.photoPrompt || socialImage.concept?.visualConcept,
      imageCta: socialImage.concept?.cta,
      imageSeed: socialImage.concept?.backgroundSeed,
      stockPhotoId: socialImage.concept?.stockPhotoId || '',
      imageKey: socialImage.imageKey || '',
      imageUrl: publishImageUrl,
      imageProvider: socialImage.provider || 'stock',
      imageFallback: Boolean(socialImage.fallback)
    });

  console.log(JSON.stringify(report, null, 2));
  if (!anyPublished) process.exitCode = 2;
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
  process.exit(1);
});
