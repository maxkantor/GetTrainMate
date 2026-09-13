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

test('production social imagery defaults to Bedrock', () => {
  assert.equal(SOCIAL_IMAGE_PROVIDER, (process.env.SOCIAL_IMAGE_PROVIDER || 'bedrock').toLowerCase());
});

test('Sunday 2026-09-13 resolves to English VIBE', () => {
  assert.equal(modeForWeekday(0), 'VIBE');
  assert.equal(languageForWeekday(0, '2026-09-13'), 'en');
});

test('VIBE copy is positive, specific, and does not reuse rejected feed/weekend hook', () => {
  const item = CATALOG.find((x) => x.contentId === 'vibe-en-new-in-town');
  const creative = resolveOwnedSocialCreative(item, { isoDate: '2026-09-13' });
  assert.equal(creative.imageHeadline, 'FIND YOUR PEOPLE. MAKE REAL PLANS.');
  assert.equal(creative.imageCta, 'EXPLORE VIBE');
  assert.match(creative.facebook, /More plans\. Better company\./);
  assert.match(creative.facebook, /friendship, shared interests and real-world plans/i);
  assert.doesNotMatch(creative.facebook, /feed is full|weekend is empty|tired of scrolling/i);
});

test('TRAIN and DATE have explicit mode-first value propositions', () => {
  const train = resolveOwnedSocialCreative(
    CATALOG.find((x) => x.contentId === 'train-en-workout-partner'),
    { isoDate: '2026-09-14' }
  );
  const date = resolveOwnedSocialCreative(
    CATALOG.find((x) => x.contentId === 'date-en-active-singles'),
    { isoDate: '2026-09-16' }
  );
  assert.equal(train.imageHeadline, 'TRAIN BETTER. TOGETHER.');
  assert.equal(date.imageHeadline, 'MEET SOMEONE WHO LIVES LIKE YOU.');
  assert.doesNotMatch(`${train.facebook} ${date.facebook}`, /guaranteed|weekend is empty/i);
});

test('overlay is full-bleed photo-first and contains no split side panel', () => {
  const svg = buildMinimalOverlaySvg({
    width: 1080,
    height: 1350,
    concept: {
      mode: 'VIBE',
      imageHeadline: 'FIND YOUR PEOPLE. MAKE REAL PLANS.',
      imageSubheadline: 'Events, hobbies, weekends — together.',
      cta: 'EXPLORE VIBE'
    }
  });
  assert.match(svg, /TRAIN • VIBE • DATE/);
  assert.match(svg, /FIND YOUR PEOPLE/);
  assert.match(svg, /EXPLORE VIBE/);
  assert.doesNotMatch(svg, /width="[4-9][0-9]{2}" height="1350"[^>]*fill="#0/);
  assert.doesNotMatch(svg, /feed|weekend is empty/i);
});
