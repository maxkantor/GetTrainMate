import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APPROVED_BASELINE,
  selectCreativePlan,
  scoreCreativeQuality,
  assessCreativeStandard,
  recentSportsFromEntries,
  CREATIVE_STANDARD_VERSION
} from '../lib/social-creative-standard.mjs';
import { buildImageConcept } from '../lib/social-image-concept.mjs';
import { buildMinimalOverlaySvg } from '../lib/social-image-photo-compose.mjs';
import { findCatalogItemByContentId } from '../lib/owned-social-catalog.mjs';
import { selectStockPhoto } from '../lib/social-image-stock.mjs';
import { recentImageEntries } from '../lib/social-image-history.mjs';

test('approved baseline is Sep 16 running visual bar', () => {
  assert.equal(APPROVED_BASELINE.sport, 'running');
  assert.equal(APPROVED_BASELINE.stage, 'vibe_to_date');
  assert.match(APPROVED_BASELINE.headline, /START WITH A RUN/);
  assert.match(APPROVED_BASELINE.localPath, /journey-running-connection/);
});

test('selectCreativePlan avoids sports used in last 5 publishes', () => {
  const recent = [
    { status: 'published', sport: 'pickleball', imageHeadline: 'x' },
    { status: 'published', sport: 'running', imageHeadline: 'y' },
    { status: 'published', sport: 'soccer', imageHeadline: 'z' },
    { status: 'published', sport: 'hiking', imageHeadline: 'a' },
    { status: 'published', sport: 'gym', imageHeadline: 'b' }
  ];
  const used = new Set(recentSportsFromEntries(recent, 5));
  for (let i = 0; i < 20; i++) {
    const plan = selectCreativePlan({
      mode: 'VIBE',
      isoDate: `2026-09-2${i % 10}`,
      contentId: `vibe-en-new-in-town:${i}`,
      recentEntries: recent,
      offset: i
    });
    assert.equal(used.has(plan.sport), false, `repeated sport ${plan.sport}`);
    assert.ok(plan.imageHeadline);
    assert.ok(plan.photoPrompt);
    assert.match(plan.cta, /FIND YOUR PEOPLE/);
  }
});

test('rejects railroad AI scenes from brand-word confusion', () => {
  const bad = assessCreativeStandard({
    mode: 'TRAIN',
    sport: 'tennis',
    scene: 'two runners jogging toward camera on railroad tracks in a forest',
    imageHeadline: 'START WITH A MATCH. SEE WHERE IT GOES.'
  });
  assert.equal(bad.ok, false);
});

test('score requires 12/14 and rejects cocktail nightlife', () => {
  const good = scoreCreativeQuality({
    sport: 'pickleball',
    stage: 'train_to_vibe',
    scene: 'man and woman walking from pickleball court paddles visible talking laughing',
    imageHeadline: "THE MATCH ENDS.\nTHE CONNECTION DOESN'T HAVE TO."
  });
  assert.equal(good.ok, true);
  assert.ok(good.total >= 12);

  const bad = assessCreativeStandard({
    scene: 'friends toasting craft cocktails in moody bar at night',
    imageHeadline: 'SAME ENERGY. NOW SAY HI.'
  });
  assert.equal(bad.ok, false);
});

test('buildImageConcept uses permanent standard by default', () => {
  const item = findCatalogItemByContentId('vibe-en-new-in-town');
  const concept = buildImageConcept(item, {
    isoDate: '2026-09-16',
    recentEntries: [{ status: 'published', sport: 'pickleball', imageHeadline: "THE MATCH ENDS. THE CONNECTION DOESN'T HAVE TO." }]
  });
  assert.equal(concept.standardVersion, CREATIVE_STANDARD_VERSION);
  assert.ok(concept.sport);
  assert.notEqual(concept.sport, 'pickleball');
  assert.doesNotMatch(concept.imageHeadline, /SAME ENERGY/i);
  assert.doesNotMatch(concept.photoPrompt, /no restaurant|no cocktail|oversexualized/i);
});

test('stock fallback fails closed when selected sport is unavailable', () => {
  const photo = selectStockPhoto({
    mode: 'DATE',
    contentId: 'date-en-sf-bay',
    isoDate: '2026-09-16',
    activity: 'swimming'
  });
  assert.equal(photo, null);
});

test('recent image history preserves publish and evergreen metadata', () => {
  const entries = recentImageEntries(
    {
      entries: [
        {
          publishedAtUtc: new Date().toISOString(),
          status: 'published',
          contentId: 'x',
          imageHeadline: 'Headline',
          imageKey: 'social/generated/x.jpg',
          imageUrl: 'https://example.com/x.jpg',
          imageProvider: 'bedrock',
          imageFallback: false,
          sport: 'soccer',
          stage: 'train_to_vibe'
        }
      ]
    },
    { days: 1 }
  );
  assert.equal(entries[0].status, 'published');
  assert.equal(entries[0].imageUrl, 'https://example.com/x.jpg');
  assert.equal(entries[0].sport, 'soccer');
  assert.equal(entries[0].stage, 'train_to_vibe');
});

test('overlay prioritizes headline + journey signature + CTA arrow', () => {
  const svg = buildMinimalOverlaySvg({
    width: 1080,
    height: 1350,
    concept: {
      mode: 'VIBE',
      imageHeadline: "THE MATCH ENDS.\nTHE CONNECTION DOESN'T HAVE TO.",
      imageSubheadline: 'Meet through what you already love doing.',
      cta: 'FIND YOUR PEOPLE →'
    }
  });
  assert.match(svg, /GetTrainMate/);
  assert.match(svg, /THE MATCH ENDS/);
  assert.match(svg, /TRAIN/);
  assert.match(svg, /VIBE/);
  assert.match(svg, /DATE/);
  assert.match(svg, /FIND YOUR PEOPLE/);
  assert.match(svg, /gettrainmate\.com/);
  assert.doesNotMatch(svg, /SAME ENERGY|LEARN MORE/i);
});
