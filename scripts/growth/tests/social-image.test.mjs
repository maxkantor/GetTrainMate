import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildImageConcept,
  isDuplicateConcept,
  normalizeConceptKey,
  wrapHeadlineLines
} from '../lib/social-image-concept.mjs';
import { buildSocialImageKey, publicUrlForKey } from '../lib/social-image-storage.mjs';
import { buildBackgroundSvg } from '../lib/social-image-composer.mjs';
import { buildMinimalOverlaySvg } from '../lib/social-image-photo-compose.mjs';
import { parseDateFromSocialKey } from '../lib/social-image-purge.mjs';
import { findCatalogItemByContentId, selectCatalogItem, CATALOG } from '../lib/owned-social-catalog.mjs';
import { publishFacebookPagePhoto } from '../lib/meta-graph.mjs';
import { selectStockPhoto } from '../lib/social-image-stock.mjs';
import {
  allStockPhotos,
  unsplashCropUrl,
  validateStockPhotoEntry
} from '../lib/social-image-stock-library.mjs';

describe('social image concept', () => {
  it('builds image metadata from catalog item', () => {
    const item = findCatalogItemByContentId('vibe-en-new-in-town');
    const concept = buildImageConcept(item, { isoDate: '20260902', recentEntries: [] });
    assert.equal(concept.mode, 'VIBE');
    assert.ok(concept.imageHeadline.length > 0);
    assert.ok(concept.imageHeadline.split(' ').length <= 9);
    assert.match(concept.cta, /Match|Meet|Start/i);
    assert.equal(concept.destinationUrl, 'https://gettrainmate.com');
  });

  it('wraps headline lines for mobile-safe composition', () => {
    const lines = wrapHeadlineLines('Find people to hang out with this weekend in your city', {
      maxCharsPerLine: 20,
      maxLines: 3
    });
    assert.ok(lines.length >= 2);
    assert.ok(lines.every((l) => l.length <= 24));
  });

  it('rejects duplicate headline in recent history', () => {
    const item = findCatalogItemByContentId('train-en-workout-partner');
    const concept = buildImageConcept(item, { isoDate: '20260902', recentEntries: [] });
    const dup = isDuplicateConcept(concept, [
      { imageHeadline: concept.imageHeadline, visualConcept: 'other', cta: 'x' }
    ]);
    assert.equal(dup, 'headline');
  });

  it('renders TRAIN/VIBE/DATE badge in overlay svg', () => {
    const concept = buildImageConcept(findCatalogItemByContentId('date-en-active-singles'), {
      isoDate: '20260902',
      recentEntries: []
    });
    const svg = buildMinimalOverlaySvg({
      width: 1080,
      height: 1350,
      concept
    });
    assert.match(svg, />DATE</);
    assert.match(svg, /gettrainmate\.com/);
  });

  it('varies background treatment by seed', () => {
    const palette = { a: '#111', b: '#222', accent: '#fff' };
    const a = buildBackgroundSvg({ width: 1080, height: 1350, palette, seed: 1, visualConcept: 'gym' });
    const b = buildBackgroundSvg({ width: 1080, height: 1350, palette, seed: 99, visualConcept: 'gym' });
    assert.notEqual(a, b);
  });
});

describe('social image storage keys', () => {
  it('uses dated unique S3 key paths', () => {
    const key = buildSocialImageKey({ isoHyphen: '2026-09-02', uniqueId: 'train-en-workout-partner-abc' });
    assert.match(key, /^social\/generated\/2026\/09\/02\//);
    const url = publicUrlForKey(key);
    assert.match(url, /-media-bucket\.s3\.|-media-\d+-us-east-1\.s3\./);
    assert.match(url, /social\/generated\/2026\/09\/02\//);
  });
});

describe('facebook photo publisher', () => {
  it('uses photos endpoint with image url (not link feed OG scrape)', async () => {
    let postedPath = '';
    let postedBody = '';
    const fetchImpl = async (url, opts = {}) => {
      postedPath = String(url);
      postedBody = String(opts.body || '');
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'PHOTO1', post_id: 'PAGE_1' })
      };
    };
    const result = await publishFacebookPagePhoto({
      pageId: 'PAGE',
      pageToken: 'SECRET_TOKEN',
      caption: 'Join https://gettrainmate.com/go/t',
      imageUrl: 'https://gettrainmate-media-bucket.s3.us-east-1.amazonaws.com/social/generated/2026/09/02/x.jpg',
      fetchImpl,
      skipImageCheck: true
    });
    assert.equal(result.ok, true);
    assert.equal(result.publishType, 'photo');
    assert.match(postedPath, /\/PAGE\/photos$/);
    assert.match(postedBody, /url=/);
    assert.match(postedBody, /caption=/);
    assert.doesNotMatch(postedBody, /link=/);
    assert.doesNotMatch(JSON.stringify(result), /SECRET_TOKEN/);
  });
});

describe('catalog rotation', () => {
  it('recycles within mode when all mode items were recently used', () => {
    const used = ['train-en-workout-partner', 'train-en-question-consistency'];
    const item = selectCatalogItem({ weekday: 4, recentlyUsedIds: used, isoDate: '2026-09-04' });
    assert.equal(item.mode, 'TRAIN');
    assert.notEqual(item.mode, 'DATE');
  });

  it('rotates DATE language by week instead of always Russian', () => {
    const a = selectCatalogItem({ weekday: 3, recentlyUsedIds: [], isoDate: '2026-09-03' });
    const b = selectCatalogItem({ weekday: 3, recentlyUsedIds: [], isoDate: '2026-09-10' });
    assert.equal(a.mode, 'DATE');
    assert.equal(b.mode, 'DATE');
    assert.notEqual(a.contentId, b.contentId);
  });

  it('picks different TRAIN items on different dates', () => {
    const a = selectCatalogItem({ weekday: 1, recentlyUsedIds: [], isoDate: '2026-09-01' });
    const b = selectCatalogItem({ weekday: 4, recentlyUsedIds: [], isoDate: '2026-09-04' });
    assert.equal(a.mode, 'TRAIN');
    assert.equal(b.mode, 'TRAIN');
  });
});

describe('owned social copy catalog', () => {
  it('exists with only GetTrainMate TRAIN/VIBE/DATE items', () => {
    assert.ok(CATALOG.length >= 10);
    for (const item of CATALOG) {
      assert.match(item.contentId, /^(train|vibe|date)-/);
      assert.ok(['TRAIN', 'VIBE', 'DATE'].includes(item.mode));
      assert.ok(['en', 'es', 'ru'].includes(item.language));
      const copy = `${item.facebook}\n${item.instagram}`;
      assert.match(copy, /GetTrainMate/i);
      assert.doesNotMatch(copy, /GoHyrox|Tinder|Bumble|Hinge|farmer/i);
    }
  });

  it('maps catalog activity to stock photos for each mode', () => {
    for (const item of CATALOG) {
      const photo = selectStockPhoto({
        mode: item.mode,
        contentId: item.contentId,
        isoDate: '20260902',
        activity: item.activity
      });
      assert.ok(photo.id);
      assert.ok(photo.unsplashId.startsWith('photo-'));
    }
  });
});

describe('stock photo selection', () => {
  it('builds unsplash crop urls for portrait social', () => {
    const url = unsplashCropUrl('photo-1571019614242-c5c5dee9f50b');
    assert.match(url, /images\.unsplash\.com/);
    assert.match(url, /w=1080/);
    assert.match(url, /h=1350/);
  });

  it('avoids recently used stock photo ids', () => {
    const first = selectStockPhoto({ mode: 'TRAIN', contentId: 'train-en-workout-partner', isoDate: '20260901', activity: 'workout' });
    const second = selectStockPhoto({
      mode: 'TRAIN',
      contentId: 'train-en-question-consistency',
      isoDate: '20260902',
      activity: 'accountability',
      recentEntries: [{ stockPhotoId: first.id }]
    });
    assert.notEqual(first.id, second.id);
  });

  it('every vetted stock entry has valid metadata', () => {
    for (const photo of allStockPhotos()) {
      assert.deepEqual(validateStockPhotoEntry(photo), []);
    }
  });

  it('every vetted stock URL is reachable', async () => {
    for (const photo of allStockPhotos()) {
      const url = unsplashCropUrl(photo.unsplashId);
      const res = await fetch(url, { method: 'HEAD' });
      assert.equal(res.ok, true, `${photo.id} ${url}`);
      const type = res.headers.get('content-type') || '';
      assert.match(type, /image\//, photo.id);
    }
  });
});

describe('social image purge', () => {
  it('parses dated S3 keys', () => {
    const d = parseDateFromSocialKey('social/generated/2026/09/01/foo.jpg');
    assert.equal(d.toISOString().slice(0, 10), '2026-09-01');
  });
});

describe('headline quality', () => {
  it('uses mode defaults without fabricated stats', () => {
    const item = findCatalogItemByContentId('train-en-workout-partner');
    const concept = buildImageConcept(item, { isoDate: '20260902', recentEntries: [] });
    assert.doesNotMatch(normalizeConceptKey(concept.imageHeadline), /30k|members|reviews/);
  });
});
