/**
 * Premium photo-first GetTrainMate social creative.
 * HARD RULES:
 * - full-bleed lifestyle photography dominates the canvas
 * - no split panels / giant dark blocks / dead space
 * - TRAIN / VIBE / DATE are always visible
 * - one short headline, one short subheadline, one CTA
 * - people remain unobstructed as much as possible
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '../../..');
const LOGO_SVG = path.join(REPO_ROOT, 'apps/web/public/brand/gtm-icon-transparent.svg');

export const SOCIAL_IMAGE_WIDTH = 1080;
export const SOCIAL_IMAGE_HEIGHT = 1350;

const MODE_COPY = {
  TRAIN: {
    headline: 'TRAIN BETTER. TOGETHER.',
    subheadline: 'Find people who match your workout style.',
    cta: 'FIND A TRAINMATE'
  },
  VIBE: {
    headline: 'FIND YOUR PEOPLE. MAKE REAL PLANS.',
    subheadline: 'Events, hobbies, weekends — together.',
    cta: 'EXPLORE VIBE'
  },
  DATE: {
    headline: 'MEET SOMEONE WHO LIVES LIKE YOU.',
    subheadline: 'Shared interests. Real chemistry.',
    cta: 'EXPLORE DATE'
  }
};

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function splitHeadline(value) {
  const words = String(value || '').trim().split(/\s+/).filter(Boolean);
  if (words.length <= 4) return [words.join(' ')];
  const target = Math.ceil(words.length / 2);
  return [words.slice(0, target).join(' '), words.slice(target).join(' ')].filter(Boolean);
}

/**
 * Exported for regression tests.
 * This SVG intentionally contains no full-height side panel or opaque full-canvas dark rectangle.
 */
export function buildMinimalOverlaySvg({ width, height, concept }) {
  const mode = String(concept.mode || 'TRAIN').toUpperCase();
  const copy = MODE_COPY[mode] || MODE_COPY.TRAIN;
  const headline = concept.imageHeadline && !/feed|scroll|weekend is empty/i.test(String(concept.imageHeadline))
    ? String(concept.imageHeadline)
    : copy.headline;
  const subheadline = concept.imageSubheadline && String(concept.imageSubheadline).length <= 70
    ? String(concept.imageSubheadline)
    : copy.subheadline;
  const ctaRaw = String(concept.cta || copy.cta).toUpperCase();
  const lines = splitHeadline(headline).slice(0, 2).map(escapeXml);
  const accent = '#7C5CFF';
  const margin = 48;
  const cardX = 34;
  const cardW = width - 68;
  const cardH = 268;
  const cardY = height - cardH - 34;
  const headlineSize = lines.some((line) => line.length > 23) ? 44 : 50;
  const ctaW = Math.min(330, Math.max(220, 70 + ctaRaw.length * 11));
  const ctaH = 52;
  const ctaX = width - margin - ctaW;
  const ctaY = height - 96;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="topShade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#05060B" stop-opacity="0.48"/>
        <stop offset="100%" stop-color="#05060B" stop-opacity="0"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.28"/>
      </filter>
    </defs>

    <!-- Only a shallow top fade for brand readability; photography remains full bleed. -->
    <rect width="${width}" height="170" fill="url(#topShade)"/>

    <!-- Compact brand header. -->
    <rect x="${margin}" y="42" width="6" height="40" rx="3" fill="${accent}"/>
    <text x="${margin + 18}" y="72" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="29" font-weight="800">GetTrainMate</text>
    <text x="${margin}" y="112" fill="#E8E3FF" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="800" letter-spacing="2.2">TRAIN • VIBE • DATE</text>
    <rect x="${width - margin - 124}" y="42" width="124" height="42" rx="21" fill="${accent}" fill-opacity="0.96"/>
    <text x="${width - margin - 62}" y="70" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="900" letter-spacing="1.5">${escapeXml(mode)}</text>

    <!-- Small glass-style lower card. Never covers more than ~20% of the image height. -->
    <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="30" fill="#07080D" fill-opacity="0.68" filter="url(#shadow)"/>
    <rect x="${cardX + 18}" y="${cardY + 18}" width="6" height="58" rx="3" fill="${accent}"/>

    <text x="${margin + 20}" y="${cardY + 66}" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="${headlineSize}" font-weight="900" letter-spacing="-0.8">${lines[0] || ''}</text>
    ${lines[1] ? `<text x="${margin + 20}" y="${cardY + 118}" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="${headlineSize}" font-weight="900" letter-spacing="-0.8">${lines[1]}</text>` : ''}
    <text x="${margin + 20}" y="${cardY + (lines[1] ? 158 : 112)}" fill="#ECEAF4" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="600">${escapeXml(subheadline)}</text>

    <text x="${margin + 20}" y="${height - 62}" fill="#FFFFFF" fill-opacity="0.94" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="700">gettrainmate.com</text>
    <rect x="${ctaX}" y="${ctaY}" width="${ctaW}" height="${ctaH}" rx="26" fill="${accent}"/>
    <text x="${ctaX + ctaW / 2}" y="${ctaY + 34}" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900">${escapeXml(ctaRaw)}</text>
  </svg>`;
}

export async function composeSocialImageFromPhoto(
  photoBuffer,
  concept,
  { width = SOCIAL_IMAGE_WIDTH, height = SOCIAL_IMAGE_HEIGHT, sharpImpl } = {}
) {
  const sharp = sharpImpl || (await import('sharp')).default;

  // Attention crop keeps faces / people in-frame instead of centering on empty scenery.
  const photo = sharp(photoBuffer)
    .rotate()
    .resize(width, height, { fit: 'cover', position: 'attention' })
    .modulate({ brightness: 1.07, saturation: 1.08 })
    .linear(1.03, -1);

  let logoComposite = null;
  if (fs.existsSync(LOGO_SVG)) {
    const logoBuffer = await sharp(fs.readFileSync(LOGO_SVG)).resize(58, 58).png().toBuffer();
    logoComposite = { input: logoBuffer, top: 31, left: width - 112 };
  }

  const composites = [
    { input: Buffer.from(buildMinimalOverlaySvg({ width, height, concept })), top: 0, left: 0 }
  ];
  if (logoComposite) composites.push(logoComposite);

  const jpeg = await photo
    .composite(composites)
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();

  if (jpeg.length < 45_000) throw new Error('gettrainmate_composed_image_too_small');

  return {
    buffer: jpeg,
    width,
    height,
    format: 'jpeg',
    source: 'photo_overlay',
    layoutId: 'GTM_FULL_BLEED_PREMIUM_V2'
  };
}

/**
 * Deliberately disabled for autonomous publishing. A generic procedural card is worse
 * than skipping a post; social-image-generator.mjs already fails closed when no photo exists.
 */
export async function composeProceduralFallback() {
  throw new Error('procedural_fallback_disabled_for_gettrainmate_social');
}
