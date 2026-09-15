import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessCreativeProductFit,
  selectEvergreenCreative,
  HARD_REJECT_STOCK_IDS
} from '../lib/social-creative-quality.mjs';
import { selectStockPhoto } from '../lib/social-image-stock.mjs';

test('rejects Sep 15 patio-dining stock id', () => {
  assert.equal(HARD_REJECT_STOCK_IDS.has('vibe-friends-patio-dining'), true);
  const r = assessCreativeProductFit({
    mode: 'VIBE',
    stockPhotoId: 'vibe-friends-patio-dining',
    scene: 'friends enjoying coffee drinks and a social meal at outdoor patio after training'
  });
  assert.equal(r.ok, false);
  assert.match(r.reason, /hard_reject_stock|generic_social|vibe_generic/);
});

test('rejects generic restaurant dining scenes for VIBE', () => {
  const r = assessCreativeProductFit({
    mode: 'VIBE',
    scene: 'large group dining at restaurant long wooden table',
    photoPrompt: 'friends enjoying a social meal'
  });
  assert.equal(r.ok, false);
});

test('accepts activity-first VIBE scenes with human connection', () => {
  const r = assessCreativeProductFit({
    mode: 'VIBE',
    stockPhotoId: 'vibe-friends-rooftop-sunset',
    scene: 'friends celebrating on rooftop overlooking city at sunset after a workout'
  });
  assert.equal(r.ok, true);
});

test('rejects cocktail-only nightlife without TRAIN context', () => {
  const r = assessCreativeProductFit({
    mode: 'VIBE',
    stockPhotoId: 'vibe-cocktail-toast-night',
    scene: 'friends toasting craft cocktails in moody bar at night'
  });
  assert.equal(r.ok, false);
});

test('rejects wine-toast nightlife stock', () => {
  assert.equal(HARD_REJECT_STOCK_IDS.has('vibe-wine-celebration-toast'), true);
});

test('accepts TRAIN partner workout scenes', () => {
  const r = assessCreativeProductFit({
    mode: 'TRAIN',
    scene: 'athletic running partners running together outdoors'
  });
  assert.equal(r.ok, true);
});

test('accepts DATE couple chemistry scenes', () => {
  const r = assessCreativeProductFit({
    mode: 'DATE',
    scene: 'attractive athletic man and woman laughing together outdoors'
  });
  assert.equal(r.ok, true);
});

test('stock selector never returns patio-dining for VIBE', () => {
  for (let i = 0; i < 40; i++) {
    const photo = selectStockPhoto({
      mode: 'VIBE',
      contentId: `vibe-en-new-in-town:${i}`,
      isoDate: `2026-09-15:${i}`,
      activity: 'cafe_after_cycle'
    });
    assert.notEqual(photo.id, 'vibe-friends-patio-dining');
    assert.doesNotMatch(String(photo.scene || ''), /restaurant|social meal|dining/i);
  }
});

test('evergreen prefers same-mode non-fallback publish', () => {
  const picked = selectEvergreenCreative(
    [
      {
        status: 'published',
        mode: 'VIBE',
        imageFallback: true,
        stockPhotoId: 'vibe-friends-patio-dining',
        imageKey: 'social/generated/bad.jpg'
      },
      {
        status: 'published',
        mode: 'TRAIN',
        imageFallback: false,
        imageKey: 'social/generated/2026/09/14/train.jpg',
        imageUrl: 'https://example.com/train.jpg'
      },
      {
        status: 'published',
        mode: 'VIBE',
        imageFallback: false,
        imageKey: 'social/generated/2026/09/13/vibe.jpg',
        imageUrl: 'https://example.com/vibe.jpg'
      }
    ],
    { mode: 'VIBE' }
  );
  assert.equal(picked.imageKey, 'social/generated/2026/09/13/vibe.jpg');
});
