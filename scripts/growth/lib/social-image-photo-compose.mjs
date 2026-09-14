/**
 * Premium photo-first GetTrainMate social creative.
 * HARD RULES (final creative direction):
 * - full-bleed lifestyle photography dominates
 * - ONE headline (+ optional short second line)
 * - small GetTrainMate branding
 * - NO fake buttons
 * - NO redundant mode badge clutter
 * - people remain unobstructed
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
    headline: 'NEED A WORKOUT PARTNER?',
    subheadline: 'Start with a workout. See what happens.'
  },
  VIBE: {
    headline: 'WORK OUT. HANG OUT. MAYBE MORE.',
    subheadline: 'If you click, keep the vibe going.'
  },
  DATE: {
    headline: 'START WITH A WORKOUT. SEE WHAT HAPPENS.',
    subheadline: 'Chemistry is optional — and up to you.'
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
 * Minimal overlay: brand + headline (+ optional short second line) + URL.
 * No CTA buttons. No mode pill badge.
 */
export function buildMinimalOverlaySvg({ width, height, concept }) {
  const mode = String(concept.mode || 'TRAIN').toUpperCase();
  const copy = MODE_COPY[mode] || MODE_COPY.TRAIN;
  const headline = concept.imageHeadline && !/feed|scroll|weekend is empty/i.test(String(concept.imageHeadline))
    ? String(concept.imageHeadline)
    : copy.headline;
  const subheadlineRaw = concept.imageSubheadline != null
    ? String(concept.imageSubheadline)
    : copy.subheadline;
  const subheadline = subheadlineRaw && subheadlineRaw.length <= 70 ? subheadlineRaw : '';
  const lines = splitHeadline(headline).slice(0, 2).map(escapeXml);
  const margin = 48;
  const headlineSize = lines.some((line) => line.length > 22) ? 46 : 54;
  const line1Y = height - (subheadline ? 168 : 128);
  const line2Y = line1Y + (lines[1] ? 58 : 0);
  const subY = (lines[1] ? line2Y : line1Y) + 48;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="topShade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#05060B" stop-opacity="0.42"/>
        <stop offset="100%" stop-color="#05060B" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="bottomShade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#05060B" stop-opacity="0"/>
        <stop offset="45%" stop-color="#05060B" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#05060B" stop-opacity="0.78"/>
      </linearGradient>
    </defs>

    <rect width="${width}" height="140" fill="url(#topShade)"/>
    <rect y="${height * 0.58}" width="${width}" height="${height * 0.42}" fill="url(#bottomShade)"/>

    <text x="${margin}" y="72" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="800">GetTrainMate</text>
    <text x="${margin}" y="102" fill="rgba(255,255,255,0.78)" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="700" letter-spacing="1.5">Train • Vibe • Date</text>

    <text x="${margin}" y="${line1Y}" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="${headlineSize}" font-weight="900" letter-spacing="-0.6">${lines[0] || ''}</text>
    ${lines[1] ? `<text x="${margin}" y="${line2Y}" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="${headlineSize}" font-weight="900" letter-spacing="-0.6">${lines[1]}</text>` : ''}
    ${subheadline ? `<text x="${margin}" y="${subY}" fill="rgba(255,255,255,0.88)" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="600">${escapeXml(subheadline)}</text>` : ''}
    <text x="${margin}" y="${height - 36}" fill="rgba(255,255,255,0.82)" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700">gettrainmate.com</text>
  </svg>`;
}

export async function composeSocialImageFromPhoto(
  photoBuffer,
  concept,
  { width = SOCIAL_IMAGE_WIDTH, height = SOCIAL_IMAGE_HEIGHT, sharpImpl } = {}
) {
  const sharp = sharpImpl || (await import('sharp')).default;

  const photo = sharp(photoBuffer)
    .rotate()
    .resize(width, height, { fit: 'cover', position: 'attention' })
    .modulate({ brightness: 1.04, saturation: 1.05 })
    .linear(1.03, -2);

  let logoComposite = null;
  if (fs.existsSync(LOGO_SVG)) {
    const logoBuffer = await sharp(fs.readFileSync(LOGO_SVG)).resize(58, 58).png().toBuffer();
    logoComposite = { input: logoBuffer, top: 28, left: width - 108 };
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
    source: 'photo_overlay'
  };
}

export async function composeProceduralFallback(concept, opts = {}) {
  const { composeSocialImage } = await import('./social-image-composer.mjs');
  const palette = concept.palette || {
    a: '#0B1220',
    b: '#134E4A',
    accent: '#7C5CFF'
  };
  return composeSocialImage({ ...concept, palette }, opts);
}
