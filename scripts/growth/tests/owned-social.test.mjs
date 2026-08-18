import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATALOG,
  languageForWeekday,
  modeForWeekday,
  renderCopy,
  selectCatalogItem,
  trackedUrl
} from '../lib/owned-social-catalog.mjs';
import { diagnoseMetaBlocker, resolveMetaCredentials } from '../lib/meta-graph.mjs';
import { recentlyUsedContentIds } from '../lib/owned-social-log.mjs';
import { rankPockets, scorePocket } from '../lib/market-density.mjs';
import { composeGrowthEmailBody } from '../lib/growth-report.mjs';

describe('owned social catalog', () => {
  it('rotates TRAIN / VIBE / DATE across weekdays', () => {
    assert.equal(modeForWeekday(1), 'TRAIN');
    assert.equal(modeForWeekday(2), 'VIBE');
    assert.equal(modeForWeekday(3), 'DATE');
    assert.equal(languageForWeekday(1), 'en');
    assert.equal(languageForWeekday(2), 'es');
    assert.equal(languageForWeekday(3), 'ru');
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
    assert.notEqual(fb, ig);
    for (const item of CATALOG) {
      assert.match(item.instagram.toLowerCase() + item.facebook.toLowerCase(), /no guaranteed|sin |не обеща|не гарантируем|nadie te garantiza/);
    }
  });

  it('skips recently used content ids', () => {
    const first = selectCatalogItem({ weekday: 1, recentlyUsedIds: [] });
    const second = selectCatalogItem({ weekday: 1, recentlyUsedIds: [first.contentId] });
    assert.equal(first.mode, 'TRAIN');
    assert.notEqual(second.contentId, first.contentId);
    assert.equal(renderCopy('Go {{url}}', 'https://x'), 'Go https://x');
  });
});

describe('meta credentials', () => {
  it('reports exact blocker without requiring per-post approval language', () => {
    const creds = resolveMetaCredentials({});
    const blocker = diagnoseMetaBlocker(creds);
    assert.match(blocker, /meta-page-access-token/i);
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
    assert.match(text, /1\) GETTRAINMATE GLOBAL GROWTH/);
    assert.match(text, /2\) GROWTH BY MODE/);
    assert.match(text, /5\) OWNED SOCIAL DISTRIBUTION/);
    assert.match(text, /Facebook: Published: NO/);
    assert.match(text, /Instagram: Published: NO/);
    assert.match(text, /6\) DECISION/);
    assert.doesNotMatch(text, /Atlanta TRAIN profiles: see Metro CRM/);
    assert.doesNotMatch(text, /APPROVED IG-2026-08-17/);
    assert.doesNotMatch(html, /Atlanta TRAIN profiles/);
    assert.match(html, /GetTrainMate global growth/i);
  });
});
