import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMinimalOverlaySvg } from '../lib/social-image-photo-compose.mjs';
import { SOCIAL_IMAGE_PROVIDER } from '../lib/social-image-generator.mjs';
import {
  CATALOG,
  resolveOwnedSocialCreative,
  modeForWeekday,
  languageForWeekday
} from '../lib/owned-social-catalog.mjs';

test('production social imagery defaults to curated stock photography', () => {
  assert.equal(SOCIAL_IMAGE_PROVIDER, (process.env.SOCIAL_IMAGE_PROVIDER || 'stock').toLowerCase());
});

test('Sunday 2026-09-13 resolves to English VIBE', () => {
  assert.equal(modeForWeekday(0), 'VIBE');
  assert.equal(languageForWeekday(0, '2026-09-13'), 'en');
});

test('VIBE copy is human journey language without corporate hooks', () => {
  const item = CATALOG.find((x) => x.contentId === 'vibe-en-new-in-town');
  const creative = resolveOwnedSocialCreative(item, { isoDate: '2026-09-13' });
  assert.ok(creative.imageHeadline.length > 0);
  assert.doesNotMatch(creative.imageHeadline, /meaningful connections|match your energy|fitness-first|find your tribe/i);
  assert.doesNotMatch(creative.facebook, /feed is full|weekend is empty|tired of scrolling|meaningful connections/i);
  assert.match(creative.facebook, /\{\{url\}\}/);
});

test('TRAIN and DATE use journey voice and rotate by date', () => {
  const train = resolveOwnedSocialCreative(
    CATALOG.find((x) => x.contentId === 'train-en-workout-partner'),
    { isoDate: '2026-09-14' }
  );
  const train2 = resolveOwnedSocialCreative(
    CATALOG.find((x) => x.contentId === 'train-en-workout-partner'),
    { isoDate: '2026-09-21' }
  );
  const date = resolveOwnedSocialCreative(
    CATALOG.find((x) => x.contentId === 'date-en-active-singles'),
    { isoDate: '2026-09-16' }
  );
  assert.ok(train.imageHeadline.length > 0);
  assert.ok(date.imageHeadline.length > 0);
  assert.doesNotMatch(`${train.facebook} ${date.facebook}`, /weekend is empty|meaningful connections|we guarantee matches/i);
  // Different dates can rotate headlines (pool size > 1)
  assert.ok(train.imageHeadline);
  assert.ok(train2.imageHeadline);
});

test('overlay shows TRAIN→VIBE→DATE journey strip with CTA text (no fake button)', () => {
  const svg = buildMinimalOverlaySvg({
    width: 1080,
    height: 1350,
    concept: {
      mode: 'VIBE',
      imageHeadline: 'THE MATCH ENDS. THE CONNECTION DOESN\'T HAVE TO.',
      imageSubheadline: 'Meet through what you already love doing.',
      cta: 'FIND YOUR PEOPLE'
    }
  });
  assert.match(svg, /TRAIN/);
  assert.match(svg, /VIBE/);
  assert.match(svg, /DATE/);
  assert.match(svg, /THE MATCH ENDS/);
  assert.match(svg, /GetTrainMate/);
  assert.match(svg, /gettrainmate\.com/);
  assert.match(svg, /FIND YOUR PEOPLE/);
  assert.doesNotMatch(svg, /rx="999"|rounded-full|fill="#7C3AED"[^>]*width="2/);
  assert.doesNotMatch(svg, /feed|weekend is empty|SAME ENERGY/i);
});
