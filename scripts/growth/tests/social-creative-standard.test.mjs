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

test('approved baseline is pickleball train_to_vibe reference', () => {
  assert.equal(APPROVED_BASELINE.sport, 'pickleball');
  assert.equal(APPROVED_BASELINE.stage, 'train_to_vibe');
  assert.match(APPROVED_BASELINE.headline, /THE MATCH ENDS/);
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
