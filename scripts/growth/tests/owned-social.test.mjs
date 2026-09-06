import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  alreadyPublishedToday,
  CATALOG,
  languageForWeekday,
  modeForWeekday,
  renderCopy,
  renderInstagramCopy,
  resolveOwnedSocialCreative,
  selectCatalogItem,
  shortTrackedUrl,
  trackedUrl
} from '../lib/owned-social-catalog.mjs';
import { assertStrongCopy } from '../lib/social-copy-variants.mjs';
import { diagnoseMetaBlocker, resolveMetaCredentials } from '../lib/meta-graph.mjs';
import { recentlyUsedContentIds, LOG_PATH } from '../lib/owned-social-log.mjs';
import { rankPockets, scorePocket } from '../lib/market-density.mjs';
import { composeGrowthEmailBody } from '../lib/growth-report.mjs';

describe('owned social catalog', () => {
  it('rotates TRAIN / VIBE / DATE across weekdays and weekends', () => {
    assert.equal(modeForWeekday(1), 'TRAIN');
    assert.equal(modeForWeekday(2), 'VIBE');
    assert.equal(modeForWeekday(3), 'DATE');
    assert.equal(modeForWeekday(4), 'TRAIN');
    assert.equal(modeForWeekday(5), 'VIBE');
    assert.equal(modeForWeekday(6), 'DATE');
    assert.equal(modeForWeekday(0), 'VIBE');
    assert.equal(languageForWeekday(1), 'en');
    assert.equal(languageForWeekday(2), 'es');
    assert.equal(languageForWeekday(3), 'ru');
    assert.equal(languageForWeekday(6), 'ru');
  });

  it('builds unique tracked URLs per network and never guarantees matches', () => {
    const fb = trackedUrl({
      network: 'facebook',
      mode: 'VIBE',
      language: 'es',
      contentId: 'vibe-es-planes-ciudad',
      landingPath: '/meet-people',
      isoDate: '20260818'
    });
    const ig = trackedUrl({
      network: 'instagram',
      mode: 'VIBE',
      language: 'es',
      contentId: 'vibe-es-planes-ciudad',
      landingPath: '/meet-people',
      isoDate: '20260818'
    });
    assert.match(fb, /utm_source=facebook/);
    assert.match(ig, /utm_source=instagram/);
    assert.match(fb, /gettrainmate\.com\/signup\?/);
    assert.match(ig, /gettrainmate\.com\/signup\?/);
    assert.notEqual(fb, ig);
    for (const item of CATALOG) {
      const creative = resolveOwnedSocialCreative(item, { isoDate: '2026-08-18' });
      const copy = `${creative.instagram}\n${creative.facebook}`;
      assert.match(copy, /GetTrainMate|TrainMate/i);
      assert.match(copy.toLowerCase(), /no guaranteed|sin |не обеща|не гарантируем|nadie te garantiza/);
      assert.equal(assertStrongCopy(creative.imageHeadline), true);
      assert.equal(assertStrongCopy(creative.imageCta), true);
    }
  });

  it('skips recently used content ids', () => {
    const first = selectCatalogItem({ weekday: 1, recentlyUsedIds: [] });
    const second = selectCatalogItem({ weekday: 1, recentlyUsedIds: [first.contentId] });
    assert.equal(first.mode, 'TRAIN');
    assert.notEqual(second.contentId, first.contentId);
    assert.equal(renderCopy('Go {{url}}', 'https://x'), 'Go https://x');
  });

  it('builds short /go URLs for Instagram captions', () => {
    const short = shortTrackedUrl({
      network: 'instagram',
      mode: 'TRAIN',
      language: 'es',
      contentId: 'train-es-socio-entrenamiento',
      landingPath: '/workout-partner',
      isoDate: '20260821'
    });
    assert.match(short, /^https:\/\/gettrainmate\.com\/go\/t\?/);
    assert.match(short, /utm_source=instagram/);
    assert.match(short, /mode=TRAIN/);
    const caption = renderInstagramCopy('Hello\n\n{{url}}', short, { language: 'es' });
    assert.match(caption, /gettrainmate\.com\/go\/t\?/);
    assert.match(caption, /Enlace también en la bio/);
    assert.doesNotMatch(caption, /\{\{url\}\}/);
  });

  it('keeps San Francisco density landing as the click target', () => {
    const url = trackedUrl({
      network: 'facebook',
      mode: 'DATE',
      language: 'en',
      contentId: 'date-en-sf',
      landingPath: '/san-francisco',
      isoDate: '20260831'
    });
    assert.match(url, /gettrainmate\.com\/san-francisco\?/);
  });

  it('prefers campaign locale over recently-used other-language items', () => {
    const used = CATALOG.filter((c) => c.mode === 'DATE' && c.language === 'en').map((c) => c.contentId);
    const item = selectCatalogItem({
      weekday: 3,
      preferLanguage: 'en',
      recentlyUsedIds: used,
      isoDate: '2026-09-04'
    });
    assert.equal(item.mode, 'DATE');
    assert.equal(item.language, 'en');
  });
});

describe('meta credentials', () => {
  it('reports exact blocker without requiring per-post approval language', () => {
    const creds = resolveMetaCredentials({});
    const blocker = diagnoseMetaBlocker(creds);
    assert.match(blocker, /page-access-token/i);
    assert.doesNotMatch(blocker, /APPROVED IG-2026-08-17/);
  });

  it('treats page token + destination ids as healthy', () => {
    const creds = resolveMetaCredentials({
      META_PAGE_ACCESS_TOKEN: 'token',
      FACEBOOK_PAGE_ID: '123',
      INSTAGRAM_BUSINESS_ACCOUNT_ID: '456'
    });
    assert.equal(diagnoseMetaBlocker(creds), null);
  });
});

describe('density ranking', () => {
  it('ranks pockets with matches above completed-only', () => {
    const ranked = rankPockets([
      { metro: 'Atlanta', mode: 'TRAIN', completedProfiles: 10, matches: 0 },
      { metro: 'Miami', mode: 'VIBE', completedProfiles: 4, matches: 2 }
    ]);
    assert.equal(ranked[0].metro, 'Miami');
    assert.ok(scorePocket(ranked[0]) > scorePocket(ranked[1]));
  });
});

describe('owned social log helpers', () => {
  it('writes the publish log under docs/growth/owned-social', () => {
    assert.match(LOG_PATH.replace(/\\/g, '/'), /docs\/growth\/owned-social\/published-log\.json$/);
  });

  it('returns published content ids inside the window', () => {
    const now = Date.parse('2026-08-18T16:00:00Z');
    const ids = recentlyUsedContentIds(
      {
        entries: [
          { contentId: 'a', status: 'published', publishedAtUtc: '2026-08-17T16:00:00Z' },
          { contentId: 'b', status: 'blocked', publishedAtUtc: '2026-08-17T16:00:00Z' },
          { contentId: 'c', status: 'published', publishedAtUtc: '2026-07-01T16:00:00Z' }
        ]
      },
      { days: 14, now }
    );
    assert.deepEqual(ids, ['a']);
  });
});

describe('growth report positioning', () => {
  it('leads with global growth and owned social, not Atlanta TRAIN as the KPI', () => {
    const { text, html } = composeGrowthEmailBody({
      snapshot: {
        sources: { ga4: 'ok', stripe: 'ok' },
        scoreboard: {
          '7d': { landings: { value: 1, available: true }, completed_profiles: { value: 1, available: true } },
          '30d': {
            landings: { value: 2, available: true },
            completed_profiles: { value: 2, available: true },
            unique_paying_customers: { value: 0, available: true },
            revenue: { value: 0, available: true }
          }
        },
        reconciliation: { ok: true, warnings: [] },
        marketplaceDensity: { status: 'unavailable' },
        ownedSocial: {
          mode: 'VIBE',
          language: 'en',
          connectorBlocker: 'Meta Page access token missing',
          facebook: { published: false, campaign: 'owned-facebook-vibe-en-20260818' },
          instagram: { published: false }
        }
      },
      health: { ok: true, checks: [] },
      experiments: [],
      generatedAt: new Date('2026-08-18T16:00:00Z')
    });
    assert.match(text, /1\) GETTRAINMATE — TODAY/);
    assert.match(text, /2\) GROWTH BY MODE/);
    assert.match(text, /5\) OWNED SOCIAL \+ META AUTHENTICATION/);
    assert.match(text, /Facebook: Published: NO/);
    assert.match(text, /Instagram: Published: NO/);
    assert.match(text, /6\) DECISION/);
    assert.doesNotMatch(text, /Atlanta TRAIN profiles: see Metro CRM/);
    assert.doesNotMatch(text, /APPROVED IG-2026-08-17/);
    assert.doesNotMatch(html, /Atlanta TRAIN profiles/);
    assert.match(html, /GetTrainMate — Growth report/);
    assert.match(html, /<h2[^>]*>GetTrainMate — Today<\/h2>/);
    assert.match(html, /<h2[^>]*>Meta authentication<\/h2>/);
    assert.match(html, /America\/New_York/);
  });

  describe('alreadyPublishedToday same-day guard', () => {
    it('returns false for empty or non-published logs', () => {
      assert.equal(alreadyPublishedToday([], '2026-09-06'), false);
      assert.equal(
        alreadyPublishedToday(
          [{ status: 'failed', publishedAtUtc: '2026-09-06T10:00:00Z', facebookPostId: 'FB1' }],
          '2026-09-06'
        ),
        false
      );
    });

    it('returns true when a post was published today with post ID', () => {
      const log = [
        {
          status: 'published',
          publishedAtUtc: '2026-09-06T14:12:43.795Z',
          facebookPostId: '1138684902641972_122131232000773778',
          instagramPostId: '18101734378982512',
          campaign: 'owned-vibe-es-2026-09-06'
        }
      ];
      assert.equal(alreadyPublishedToday(log, '2026-09-06'), true);
      assert.equal(alreadyPublishedToday(log, '2026-09-07'), false);
    });
  });
});
