import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMinimalOverlaySvg } from '../lib/social-image-photo-compose.mjs';

test('photo-first creative has no giant left copy panel', () => {
  const svg = buildMinimalOverlaySvg({
    width: 1080,
    height: 1350,
    concept: { mode: 'TRAIN', imageHeadline: 'NEED A WORKOUT PARTNER?' }
  });
  assert.doesNotMatch(svg, /leftPanel/);
  assert.match(svg, /bottomShade/);
});

test('TRAIN VIBE DATE stays visible as one brand without mode pill badge', () => {
  for (const mode of ['TRAIN', 'VIBE', 'DATE']) {
    const svg = buildMinimalOverlaySvg({
      width: 1080,
      height: 1350,
      concept: { mode, imageHeadline: 'FIND YOUR PEOPLE' }
    });
    assert.match(svg, /TRAIN/);
    assert.match(svg, /VIBE/);
    assert.match(svg, /DATE/);
    assert.match(svg, /GetTrainMate/);
    assert.match(svg, /gettrainmate\.com/);
    // No redundant mode pill
    assert.doesNotMatch(svg, new RegExp(`rx="21"[^>]*>\\s*${mode}`));
  }
});

test('overlay never buries the photo under a full card or fake button', () => {
  const svg = buildMinimalOverlaySvg({
    width: 1080,
    height: 1350,
    concept: { mode: 'DATE', imageHeadline: 'START WITH A WORKOUT. SEE WHAT HAPPENS.', cta: 'SEE WHAT HAPPENS' }
  });
  assert.doesNotMatch(svg, /width="7[0-9][0-9]" height="1350"/);
  assert.doesNotMatch(svg, /<rect[^>]*rx="2[0-9]"[^>]*fill="#/); // no pill CTA button
  assert.match(svg, /START WITH A WORKOUT/);
});
