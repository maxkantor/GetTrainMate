import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMinimalOverlaySvg } from '../lib/social-image-photo-compose.mjs';

test('photo-first creative has no giant left copy panel', () => {
  const svg = buildMinimalOverlaySvg({ width: 1080, height: 1350, concept: { mode: 'TRAIN', imageHeadline: 'BETTER WORKOUTS START TOGETHER', cta: 'FIND A TRAINMATE' } });
  assert.doesNotMatch(svg, /leftPanel/);
  assert.match(svg, /bottomFade/);
});

test('TRAIN VIBE DATE stays visible as one brand', () => {
  for (const mode of ['TRAIN','VIBE','DATE']) {
    const svg = buildMinimalOverlaySvg({ width: 1080, height: 1350, concept: { mode, imageHeadline: 'FIND YOUR PEOPLE' } });
    assert.match(svg, /TRAIN • VIBE • DATE/);
    assert.match(svg, new RegExp(`>${mode}<`));
    assert.match(svg, /gettrainmate\.com/);
  }
});

test('overlay never buries the photo under a full card', () => {
  const svg = buildMinimalOverlaySvg({ width: 1080, height: 1350, concept: { mode: 'DATE', imageHeadline: 'ACTIVE PEOPLE. REAL CHEMISTRY.' } });
  assert.doesNotMatch(svg, /width="7[0-9][0-9]" height="1350"/);
});
