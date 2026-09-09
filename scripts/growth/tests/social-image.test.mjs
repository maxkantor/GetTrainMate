import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildImageConcept,
  determinePostActivity,
  isDuplicateConcept,
  normalizeConceptKey,
  wrapHeadlineLines
} from '../lib/social-image-concept.mjs';
import { DEFAULT_NEGATIVE_PROMPT, buildPhotographyPrompt } from '../lib/social-image-bedrock.mjs';
import { buildSocialImageKey, publicUrlForKey } from '../lib/social-image-storage.mjs';
import { buildBackgroundSvg } from '../lib/social-image-composer.mjs';
import { buildMinimalOverlaySvg } from '../lib/social-image-photo-compose.mjs';
import { parseDateFromSocialKey } from '../lib/social-image-purge.mjs';
import { findCatalogItemByContentId, selectCatalogItem, CATALOG } from '../lib/owned-social-catalog.mjs';
import { publishFacebookPagePhoto } from '../lib/meta-graph.mjs';
import { selectStockPhoto } from '../lib/social-image-stock.mjs';
import {
  PROHIBITED_VIBE_KEYWORDS,
  STOCK_PHOTOS,
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
    assert.match(concept.cta, /FIND|DISCOVER|START|EXPLORE|MEET|ENCUENTRA|НАЙТИ|ОТКРЫТЬ|СМОТРЕТЬ/i);
    assert.equal(concept.destinationUrl, 'https://gettrainmate.com');
    assert.equal(concept.language, 'en');
    assert.doesNotMatch(normalizeConceptKey(concept.imageHeadline), /meet through real chemistry/);
    assert.doesNotMatch(normalizeConceptKey(concept.cta), /start matching/);
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

describe('semantic activity matching', () => {
  it('extracts precise activity from post text for TRAIN', () => {
    assert.equal(determinePostActivity({ mode: 'TRAIN', text: 'Looking for a pickleball partner for weekend games' }), 'pickleball');
    assert.equal(determinePostActivity({ mode: 'TRAIN', text: 'Find someone to hit tennis balls with this Tuesday' }), 'tennis');
    assert.equal(determinePostActivity({ mode: 'TRAIN', text: 'Outdoor running group for 5k and 10k prep' }), 'running');
    assert.equal(determinePostActivity({ mode: 'TRAIN', text: 'Long cycling rides on Saturday mornings' }), 'cycling');
    assert.equal(determinePostActivity({ mode: 'TRAIN', text: 'HYROX and functional fitness workout partner' }), 'functional');
    assert.equal(determinePostActivity({ mode: 'TRAIN', text: 'Someone who shows up so you never train alone' }), 'partner');
  });

  it('extracts precise activity from post text for VIBE', () => {
    assert.equal(determinePostActivity({ mode: 'VIBE', text: 'Anyone want to hike this mountain trail on Saturday?' }), 'hiking');
    assert.equal(determinePostActivity({ mode: 'VIBE', text: 'Let us grab social coffee and check out new local spots' }), 'coffee');
    assert.equal(determinePostActivity({ mode: 'VIBE', text: 'Rooftop cocktails and drinks with good people' }), 'drinks');
    assert.equal(determinePostActivity({ mode: 'VIBE', text: 'Casual patio restaurant dinner with a small group' }), 'dining');
    assert.equal(determinePostActivity({ mode: 'VIBE', text: 'Live music concert and local street festival this weekend' }), 'festival');
    assert.equal(determinePostActivity({ mode: 'VIBE', text: 'Exploring city spots and fun weekend plans' }), 'city');
  });

  it('extracts precise activity from post text for DATE', () => {
    assert.equal(determinePostActivity({ mode: 'DATE', text: 'Meet someone with active lifestyle and real chemistry' }), 'lifestyle');
    assert.equal(determinePostActivity({ mode: 'DATE', text: 'Conoce solteros activos cerca de ti. Cansado de deslizar sin parar?' }), 'lifestyle');
    assert.equal(determinePostActivity({ mode: 'DATE', text: 'A relaxed coffee date where conversation actually flows' }), 'coffee');
    assert.equal(determinePostActivity({ mode: 'DATE', text: 'Evening drinks at a speakeasy or rooftop bar' }), 'drinks');
    assert.equal(determinePostActivity({ mode: 'DATE', text: 'Romantic walk through the city holding hands' }), 'walk');
    assert.equal(determinePostActivity({ mode: 'DATE', text: 'Dinner date at a cozy neighborhood restaurant' }), 'dinner');
  });

  it('selects stock photos matching semantic activity', () => {
    const picklePhoto = selectStockPhoto({ mode: 'TRAIN', activity: 'pickleball' });
    assert.ok(picklePhoto.activities.includes('pickleball'));
    assert.match(picklePhoto.scene, /pickleball/i);

    const hikePhoto = selectStockPhoto({ mode: 'VIBE', activity: 'hiking' });
    assert.ok(hikePhoto.activities.includes('hiking'));
    assert.match(hikePhoto.scene, /hiking/i);

    const coffeePhoto = selectStockPhoto({ mode: 'VIBE', activity: 'coffee' });
    assert.ok(coffeePhoto.activities.includes('coffee'));
    assert.match(coffeePhoto.scene, /coffee/i);

    const diningPhoto = selectStockPhoto({ mode: 'VIBE', activity: 'dining' });
    assert.ok(diningPhoto.activities.includes('dining') || diningPhoto.activities.includes('restaurant'));

    const dateCoffee = selectStockPhoto({ mode: 'DATE', activity: 'coffee' });
    assert.ok(dateCoffee.activities.includes('coffee'));
    assert.match(dateCoffee.scene, /cafe|coffee|espresso/i);

    const dateLifestyle = selectStockPhoto({ mode: 'DATE', activity: 'lifestyle' });
    assert.ok(
      dateLifestyle.activities.includes('lifestyle') ||
        dateLifestyle.activities.includes('active') ||
        dateLifestyle.activities.includes('outdoor')
    );
    assert.doesNotMatch(dateLifestyle.id, /daytime-laughter/);

    const dateWalk = selectStockPhoto({ mode: 'DATE', activity: 'walk' });
    assert.ok(dateWalk.activities.includes('walk'));
  });

  it('strictly enforces no laptops/offices in VIBE stock photos', () => {
    for (const photo of STOCK_PHOTOS.VIBE) {
      const text = `${photo.scene} ${photo.activities.join(' ')}`.toLowerCase();
      for (const forbidden of PROHIBITED_VIBE_KEYWORDS) {
        assert.equal(
          text.includes(forbidden),
          false,
          `VIBE photo ${photo.id} contains prohibited keyword: "${forbidden}" in "${text}"`
        );
      }
    }
  });

  it('includes strict office exclusions in Bedrock prompt and negative prompt', () => {
    for (const word of ['laptops', 'computer screens', 'office desks', 'coworking space', 'business meetings']) {
      assert.ok(
        DEFAULT_NEGATIVE_PROMPT.includes(word),
        `DEFAULT_NEGATIVE_PROMPT missing "${word}"`
      );
    }

    const vibePrompt = buildPhotographyPrompt({ mode: 'VIBE', photoPrompt: 'friends having coffee at a cafe' });
    assert.match(vibePrompt, /social activity/i);
    assert.match(vibePrompt, /completely free of laptops/i);

    const datePrompt = buildPhotographyPrompt({ mode: 'DATE', photoPrompt: 'couple enjoying drinks' });
    assert.match(datePrompt, /romantic chemistry/i);

    const trainPrompt = buildPhotographyPrompt({ mode: 'TRAIN', photoPrompt: 'gym partners workout' });
    assert.match(trainPrompt, /sports and lifestyle photography/i);
  });

  it('guarantees mode consistency: TRAIN post -> TRAIN imagery/CTA, VIBE post -> VIBE, DATE post -> DATE', () => {
    const trainItem = findCatalogItemByContentId('train-en-workout-partner');
    const trainConcept = buildImageConcept(trainItem, { isoDate: '20260908' });
    assert.equal(trainConcept.mode, 'TRAIN');
    assert.match(trainConcept.cta, /PARTNER|TRAIN|START|WORKOUT|FIND/i);

    const vibeItem = findCatalogItemByContentId('vibe-en-new-in-town');
    const vibeConcept = buildImageConcept(vibeItem, { isoDate: '20260908' });
    assert.equal(vibeConcept.mode, 'VIBE');
    assert.match(vibeConcept.cta, /VIBE|EXPLORE|MEET|FRIENDS|PEOPLE|DISCOVER/i);
    assert.doesNotMatch(vibeConcept.photoPrompt.toLowerCase(), /laptop|office|coworking|study|working/);

    const dateItem = findCatalogItemByContentId('date-en-active-singles');
    const dateConcept = buildImageConcept(dateItem, { isoDate: '20260908' });
    assert.equal(dateConcept.mode, 'DATE');
    assert.match(dateConcept.cta, /DATE|MATCH|FIND|MEET|CONNECT/i);
  });
});
