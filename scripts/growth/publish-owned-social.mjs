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
  alreadyPublishedToday,
  easternIsoDate,
  easternWeekday,
  findCatalogItemByContentId,
  renderFacebookCopy,
  renderInstagramCopy,
  resolveOwnedSocialCreative,
  selectCatalogItem,
  shortTrackedUrl
} from './lib/owned-social-catalog.mjs';
import {
  diagnoseMetaBlocker,
  publishFacebookPagePhoto,
  publishInstagramMedia,
  resolveMetaCredentials
} from './lib/meta-graph.mjs';
import {
  META_REPORT_STATES,
  metaAuthFromValidation,
  ownerSetupInstructions,
  validateMetaCredentials
} from './lib/meta-token.mjs';
import { appendPublishedLog, readPublishedLog, recentlyUsedContentIds } from './lib/owned-social-log.mjs';
import { loadRecentImageHistory } from './lib/social-image-history.mjs';
import { generateSocialImage } from './lib/social-image-generator.mjs';
import { logSocialImageEvent } from './lib/social-image-logger.mjs';
import { purgeOldSocialImages } from './lib/social-image-purge.mjs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __growthDir = path.dirname(fileURLToPath(import.meta.url));

function ensureSocialImageBucketPublic() {
  const script = path.join(__growthDir, 'ensure-social-image-bucket-public.mjs');
  const r = spawnSync(process.execPath, [script], { encoding: 'utf8', stdio: 'pipe' });
  if (r.status !== 0) {
    throw new Error(
      `social_image_bucket_not_public:${(r.stderr || r.stdout || 'ensure failed').slice(0, 200)}`
    );
  }
}

function parseArgs(argv) {
  const out = { dryRun: false, skipFacebook: false, skipInstagram: false, contentId: null, forcePublish: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    if (a === '--skip-facebook') out.skipFacebook = true;
    if (a === '--skip-instagram') out.skipInstagram = true;
    if (a === '--content-id') out.contentId = argv[++i] || null;
    if (a === '--force-publish' || a === '--force') out.forcePublish = true;
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
  const ssmLoad = loadSsmSecretsIntoEnv();
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

  const recentImageEntries = loadRecentImageHistory({ days: 30 });
  item = resolveOwnedSocialCreative(item, {
    isoDate: isoHyphen,
    recentEntries: recentImageEntries
  });

  // Strict same-day guard: prevent duplicate publishing to Meta if already published today
  if (!args.dryRun && !args.forcePublish && alreadyPublishedToday(log.entries || [], isoHyphen)) {
    const todaysEntry = (log.entries || []).slice().reverse().find((e) => {
      const d = e.publishedAtUtc ? easternIsoDate(new Date(e.publishedAtUtc)) : '';
      return (d === isoHyphen || (typeof e.campaign === 'string' && e.campaign.includes(isoHyphen))) && e.status === 'published';
    });
    console.log(
      JSON.stringify({
        ok: true,
        skipped: true,
        alreadyPublishedToday: true,
        reason: 'social_already_published_today',
        isoDate: isoHyphen,
        contentId: todaysEntry?.contentId || item?.contentId || '',
        distributionAttempted: false,
        distributionExecuted: false,
        technicalDistributionResult: 'SKIPPED_ALREADY_PUBLISHED_TODAY',
        facebook: {
          network: 'facebook',
          published: false,
          postId: todaysEntry?.facebookPostId || '',
          reason: 'already_published_today'
        },
        instagram: {
          network: 'instagram',
          published: false,
          postId: todaysEntry?.instagramPostId || '',
          reason: 'already_published_today'
        }
      })
    );
    return;
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
  if (ssmLoad.ssmAccessDenied && !creds.pageToken) {
    validation = await validateMetaCredentials({
      pageToken: '',
      pageId: creds.pageId,
      igUserId: creds.igUserId,
      ssmAccessDenied: true
    });
  } else if (!configBlocker && !args.dryRun) {
    validation = await validateMetaCredentials({
      pageToken: creds.pageToken,
      pageId: creds.pageId,
      igUserId: creds.igUserId,
      appId: process.env.META_APP_ID || '',
      appSecret: process.env.META_APP_SECRET || '',
      ssmAccessDenied: Boolean(ssmLoad.ssmAccessDenied)
    });
  } else if (configBlocker && ssmLoad.ssmAccessDenied) {
    validation = await validateMetaCredentials({
      pageToken: '',
      pageId: creds.pageId,
      igUserId: creds.igUserId,
      ssmAccessDenied: true
    });
  }

  const metaAuth = validation
    ? metaAuthFromValidation(validation)
    : metaAuthFromValidation(null, {
        configuration: configBlocker ? 'MISSING' : args.dryRun ? 'PRESENT' : 'UNKNOWN',
        status: configBlocker
          ? META_REPORT_STATES.MISSING_CONFIGURATION
          : args.dryRun
            ? 'DRY_RUN_OR_SKIPPED'
            : META_REPORT_STATES.MISSING_CONFIGURATION,
        pageId: creds.pageId,
        instagramId: creds.igUserId
      });
  if (!validation && configBlocker) {
    metaAuth.authentication = 'INVALID';
    metaAuth.ownerActionRequired = true;
    metaAuth.facebookPublishing = 'BLOCKED';
    metaAuth.instagramPublishing = 'BLOCKED';
  }
  if (args.dryRun && !configBlocker) {
    metaAuth.authentication = 'UNCHECKED';
    metaAuth.status = 'DRY_RUN_OR_SKIPPED';
    metaAuth.ownerActionRequired = false;
  }

  console.error(
    JSON.stringify({
      event: 'MetaCredentialCheck',
      ssmAccessDenied: Boolean(ssmLoad.ssmAccessDenied),
      hasToken: Boolean(creds.pageToken),
      pageId: creds.pageId || null,
      igUserId: creds.igUserId || null,
      configuration: metaAuth.configuration,
      authentication: metaAuth.authentication,
      status: metaAuth.status,
      ownerActionRequired: metaAuth.ownerActionRequired
    })
  );

  const connectorBlocker = configBlocker
    ? configBlocker
    : validation && !validation.ok
      ? `${validation.reportStatus || validation.state}: ${validation.graph?.message || 'Meta authentication invalid'}${validation.ownerActionRequired ? ` · ${ownerSetupInstructions().split('\n')[0]}` : ''}`
      : null;

  const trackingFields = {
    mode: item.mode,
    language: item.language,
    contentId: item.contentId,
    landingPath: item.landingPath,
    isoDate,
    market: item.market,
    copyVariant: item.copy_variant,
    headlineVariant: item.headline_variant,
    ctaVariant: item.cta_variant
  };
  const facebookShortUrl = shortTrackedUrl({ network: 'facebook', ...trackingFields });
  const instagramUrl = shortTrackedUrl({ network: 'instagram', ...trackingFields });
  // Facebook + Instagram: publish generated branded image as media (not website OG link preview).
  const facebookCopy = renderFacebookCopy(item.facebook, facebookShortUrl);
  const instagramCopy = renderInstagramCopy(item.instagram, instagramUrl, {
    language: item.language
  });

  console.error(
    JSON.stringify({
      event: 'OwnedSocialCopySelected',
      mode: item.mode,
      locale: item.locale || item.language,
      contentId: item.contentId,
      copy_variant: item.copy_variant || null,
      headline_variant: item.headline_variant || null,
      cta_variant: item.cta_variant || null,
      imageHeadline: item.imageHeadline || null,
      imageCta: item.imageCta || null
    })
  );

  const baseReport = {
    generatedAtUtc: now.toISOString(),
    isoDate: isoHyphen,
    weekday,
    contentId: item.contentId,
    mode: item.mode,
    language: item.language,
    locale: item.locale || item.language,
    copy_variant: item.copy_variant || '',
    headline_variant: item.headline_variant || '',
    cta_variant: item.cta_variant || '',
    campaign: item.campaign || '',
    kind: item.kind,
    connectorHealthy: !connectorBlocker && (validation ? validation.ok === true : !configBlocker),
    connectorBlocker,
    metaAuth,
    distributionAttempted: !args.dryRun,
    distributionExecuted: false,
    technicalDistributionResult: args.dryRun ? 'DRY_RUN' : 'NOT_ATTEMPTED',
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

  if (connectorBlocker && !args.dryRun) {
    baseReport.facebook.blocker = connectorBlocker;
    baseReport.instagram.blocker = connectorBlocker;
    baseReport.technicalDistributionResult = 'FAILED';
    appendPublishedLog({
      publishedAtUtc: now.toISOString(),
      contentId: item.contentId,
      mode: item.mode,
      language: item.language,
      status: 'blocked',
      blocker: connectorBlocker,
      metaStatus: metaAuth.status || '',
      imageHeadline: '',
      visualConcept: '',
      imageKey: ''
    });
    console.error(
      JSON.stringify({
        event: 'MetaPublishBlocked',
        status: metaAuth.status,
        ownerActionRequired: metaAuth.ownerActionRequired,
        facebook: 'BLOCKED',
        instagram: 'BLOCKED'
      })
    );
    console.log(JSON.stringify(baseReport, null, 2));
    process.exitCode = 2;
    return;
  }

  if (!args.dryRun) {
    ensureSocialImageBucketPublic();
    purgeOldSocialImages({ days: Number(process.env.SOCIAL_IMAGE_RETENTION_DAYS || 30) });
  }
  let socialImage;
  try {
    socialImage = await generateSocialImage({
      catalogItem: item,
      isoDate,
      isoHyphen,
      recentImageEntries,
      dryRun: args.dryRun,
      conceptOverrides: {
        language: item.language,
        imageHeadline: item.imageHeadline,
        imageSubheadline: item.imageSubheadline || '',
        cta: item.imageCta,
        copyPackage: item.copyPackage
      }
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
    ...baseReport,
    socialImage: {
      mode: socialImage.concept?.mode || item.mode,
      locale: socialImage.concept?.locale || item.language,
      imageHeadline: socialImage.concept?.imageHeadline || '',
      imageSubheadline: socialImage.concept?.imageSubheadline || '',
      visualConcept: socialImage.concept?.visualConcept || '',
      cta: socialImage.concept?.cta || '',
      headline_variant: socialImage.concept?.headlineVariant || item.headline_variant || '',
      cta_variant: socialImage.concept?.ctaVariant || item.cta_variant || '',
      copy_variant: socialImage.concept?.copyVariant || item.copy_variant || '',
      provider: socialImage.provider || 'procedural',
      fallback: Boolean(socialImage.fallback),
      imageKey: socialImage.imageKey || '',
      imageUrl: generatedImageUrl,
      localPath: socialImage.localPath || '',
      mediaCheck: socialImage.mediaCheck || null,
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
    report.technicalDistributionResult = 'FAILED';
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

  if (!args.skipFacebook) {
    const fb = await publishFacebookPagePhoto({
      pageId: creds.pageId,
      pageToken: creds.pageToken,
      caption: facebookCopy,
      imageUrl: publishImageUrl,
      imageBuffer: socialImage.imageBuffer || null
    });
    const fbPostId = String(fb.postId || '').trim();
    report.facebook.published = Boolean(fb.ok && fbPostId);
    report.facebook.postId = report.facebook.published ? fbPostId : '';
    report.facebook.postUrl = report.facebook.published ? fb.postUrl || '' : '';
    report.facebook.blocker = report.facebook.published
      ? ''
      : fb.blocker || META_REPORT_STATES.FACEBOOK_PUBLISH_FAILED;
    report.facebook.publishType = fb.publishType || 'photo';
    report.facebook.imageUrl = publishImageUrl;
    console.error(
      JSON.stringify({
        event: 'FacebookPublishResult',
        published: report.facebook.published,
        postId: report.facebook.postId || null,
        blocker: report.facebook.blocker || null
      })
    );
    if (report.facebook.published) {
      logSocialImageEvent('FacebookImagePostPublished', {
        mode: item.mode,
        postId: report.facebook.postId,
        imageKey: socialImage.imageKey,
        publishType: 'photo'
      });
    } else if (report.metaAuth?.authentication === 'VALID') {
      report.metaAuth = {
        ...report.metaAuth,
        facebookPublishing: META_REPORT_STATES.FACEBOOK_PUBLISH_FAILED
      };
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
    const igPostId = String(ig.igPublishedMediaId || ig.postId || '').trim();
    report.instagram.published = Boolean(ig.ok && igPostId);
    report.instagram.postId = report.instagram.published ? igPostId : '';
    report.instagram.postUrl = report.instagram.published ? ig.postUrl || '' : '';
    report.instagram.blocker = report.instagram.published
      ? ''
      : ig.blocker || META_REPORT_STATES.INSTAGRAM_PUBLISH_FAILED;
    report.instagram.state = ig.state || '';
    report.instagram.igCreationId = ig.igCreationId || '';
    report.instagram.containerStatus = ig.containerStatus || '';
    report.instagram.failureStage = ig.failureStage || null;
    report.instagram.imageUrl = publishImageUrl;
    console.error(
      JSON.stringify({
        event: 'InstagramPublishResult',
        published: report.instagram.published,
        postId: report.instagram.postId || null,
        state: report.instagram.state || null,
        blocker: report.instagram.blocker || null
      })
    );
    if (report.instagram.published) {
      logSocialImageEvent('InstagramImagePostPublished', {
        mode: item.mode,
        postId: report.instagram.postId,
        imageKey: socialImage.imageKey
      });
    } else if (report.metaAuth?.authentication === 'VALID') {
      report.metaAuth = {
        ...report.metaAuth,
        instagramPublishing: META_REPORT_STATES.INSTAGRAM_PUBLISH_FAILED
      };
    }
  } else {
    report.instagram.blocker = 'skipped';
  }

  // Keep Meta auth VALID even when Instagram publish fails for non-auth reasons (not when skipped).
  if (
    report.metaAuth?.authentication === 'VALID' &&
    report.instagram.blocker &&
    report.instagram.blocker !== 'skipped' &&
    !report.instagram.published
  ) {
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
    locale: item.locale || item.language,
    campaign: item.campaign || '',
    copy_variant: item.copy_variant || '',
    headline_variant: item.headline_variant || '',
    cta_variant: item.cta_variant || '',
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
