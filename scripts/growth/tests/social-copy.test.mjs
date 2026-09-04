import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  HEADLINE_VARIANTS,
  CTA_VARIANTS,
  POST_VARIANTS,
  assertStrongCopy,
  formatPostBody,
  selectCopyPackage,
  WEAK_COPY_PATTERNS
} from '../lib/social-copy-variants.mjs';
import { buildImageConcept } from '../lib/social-image-concept.mjs';
import {
  resolveOwnedSocialCreative,
  renderInstagramCopy,
  trackedUrl,
  findCatalogItemByContentId
} from '../lib/owned-social-catalog.mjs';

describe('social copy variants', () => {
  it('provides benefit-driven DATE / TRAIN / VIBE headlines in en/es/ru', () => {
    for (const mode of ['TRAIN', 'VIBE', 'DATE']) {
      for (const locale of ['en', 'es', 'ru']) {
        assert.ok(HEADLINE_VARIANTS[mode][locale].length >= 4);
        assert.ok(CTA_VARIANTS[mode][locale].length >= 4);
        assert.ok(POST_VARIANTS[mode][locale].length >= 3);
        for (const h of HEADLINE_VARIANTS[mode][locale]) {
          assert.equal(assertStrongCopy(h.text), true, h.text);
        }
        for (const c of CTA_VARIANTS[mode][locale]) {
          assert.equal(assertStrongCopy(c.text), true, c.text);
        }
      }
    }
    assert.ok(HEADLINE_VARIANTS.DATE.en.some((h) => /MATCHES YOUR ENERGY/i.test(h.text)));
    assert.ok(CTA_VARIANTS.DATE.en.some((c) => /FIND YOUR MATCH/i.test(c.text)));
    assert.ok(CTA_VARIANTS.TRAIN.en.some((c) => /TRAINING PARTNER/i.test(c.text)));
    assert.ok(CTA_VARIANTS.VIBE.en.some((c) => /FIND YOUR PEOPLE/i.test(c.text)));
  });

  it('rejects weak generic dating/product phrases', () => {
    assert.equal(assertStrongCopy('Meet Through Real Chemistry'), false);
    assert.equal(assertStrongCopy('START MATCHING'), false);
    assert.equal(assertStrongCopy('GetTrainMate helps you meet people'), false);
    assert.ok(WEAK_COPY_PATTERNS.length >= 4);
  });

  it('formats posts as hook + benefit + differentiator + CTA', () => {
    const pkg = selectCopyPackage({
      mode: 'DATE',
      language: 'en',
      isoDate: '2026-09-04',
      contentId: 'date-en-active-singles'
    });
    const body = formatPostBody(pkg.post);
    assert.match(body, /\n\n/);
    assert.match(body, /\{\{url\}\}/);
    assert.match(body, /No guaranteed|You control/i);
    assert.equal(assertStrongCopy(body), true);
    assert.ok(pkg.headline);
    assert.ok(pkg.cta);
    assert.ok(pkg.copyVariant);
    assert.equal(pkg.locale, 'en');
  });

  it('keeps image and post language aligned for Russian campaigns', () => {
    const item = resolveOwnedSocialCreative(findCatalogItemByContentId('date-ru-po-interesam'), {
      isoDate: '2026-09-04',
      recentEntries: []
    });
    assert.equal(item.language, 'ru');
    assert.equal(item.locale, 'ru');
    assert.match(item.imageHeadline, /[А-Яа-яЁё]/);
    assert.match(item.facebook, /[А-Яа-яЁё]/);
    assert.match(item.instagram, /[А-Яа-яЁё]/);
    assert.doesNotMatch(item.imageHeadline, /Meet Through Real Chemistry|START MATCHING/i);
    const concept = buildImageConcept(item, { isoDate: '20260904', recentEntries: [] });
    assert.equal(concept.language, 'ru');
    assert.match(concept.imageHeadline, /[А-Яа-яЁё]/);
    assert.match(concept.cta, /[А-Яа-яЁё]/);
  });

  it('avoids repeating the same headline when recent history has it', () => {
    const first = selectCopyPackage({
      mode: 'DATE',
      language: 'en',
      isoDate: '2026-09-04',
      contentId: 'date-en-active-singles'
    });
    const second = selectCopyPackage({
      mode: 'DATE',
      language: 'en',
      isoDate: '2026-09-04',
      contentId: 'date-en-active-singles',
      recentEntries: [{ imageHeadline: first.headline, headlineVariant: first.headlineVariant }]
    });
    assert.notEqual(normalize(second.headline), normalize(first.headline));
  });

  it('tracks copy analytics fields on tracked URLs', () => {
    const url = trackedUrl({
      network: 'facebook',
      mode: 'DATE',
      language: 'en',
      contentId: 'date-en-active-singles',
      landingPath: '/active-dating',
      isoDate: '20260904',
      copyVariant: 'date-post-swiping',
      headlineVariant: 'date-hl-energy',
      ctaVariant: 'date-cta-match'
    });
    assert.match(url, /utm_source=facebook/);
    assert.match(url, /utm_medium=organic/);
    assert.match(url, /copy_variant=date-post-swiping/);
    assert.match(url, /headline_variant=date-hl-energy/);
    assert.match(url, /cta_variant=date-cta-match/);
    assert.match(url, /utm_content=date-en-active-singles__date-post-swiping__/);
  });

  it('localizes Instagram bio link line', () => {
    const en = renderInstagramCopy('Hello\n\n{{url}}', 'https://gettrainmate.com/go/d?x=1', {
      language: 'en'
    });
    const ru = renderInstagramCopy('Привет\n\n{{url}}', 'https://gettrainmate.com/go/d?x=1', {
      language: 'ru'
    });
    assert.match(en, /Link also in bio/);
    assert.match(ru, /Ссылка также в профиле/);
  });
});

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
