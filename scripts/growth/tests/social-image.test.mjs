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
import { findCatalogItemByContentId, selectCatalogItem } from '../lib/owned-social-catalog.mjs';
import { publishFacebookPagePhoto } from '../lib/meta-graph.mjs';

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
    assert.match(url, /gettrainmate-media-bucket\.s3\./);
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
    const item = selectCatalogItem({ weekday: 4, recentlyUsedIds: used });
    assert.equal(item.mode, 'TRAIN');
    assert.notEqual(item.mode, 'DATE');
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
