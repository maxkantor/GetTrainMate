/**
 * Compose final social image: full-bleed AI photo + minimal GetTrainMate branding overlay.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { composeSocialImage } from './social-image-composer.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '../../..');
const LOGO_SVG = path.join(REPO_ROOT, 'apps/web/public/brand/gtm-icon-transparent.svg');

export const SOCIAL_IMAGE_WIDTH = 1080;
export const SOCIAL_IMAGE_HEIGHT = 1350;

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Minimal overlay — photo is the hero; text only where specified. */
export function buildMinimalOverlaySvg({ width, height, concept }) {
  const brand = escapeXml('GetTrainMate');
  const mode = escapeXml(concept.mode || 'TRAIN');
  const headline = escapeXml(concept.imageHeadline || 'Find Your Match');
  const cta = escapeXml(String(concept.cta || 'START MATCHING').toUpperCase());
  const url = escapeXml('gettrainmate.com');

  // Headline: max 2 lines, bottom third, above CTA
  const words = headline.split(' ');
  let line1 = headline;
  let line2 = '';
  if (words.length > 4) {
    line1 = words.slice(0, Math.ceil(words.length / 2)).join(' ');
    line2 = words.slice(Math.ceil(words.length / 2)).join(' ');
  }
  line1 = escapeXml(line1);
  line2 = escapeXml(line2);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bottomFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="45%" stop-color="#000000" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.82"/>
    </linearGradient>
  </defs>
  <rect x="0" y="${height * 0.55}" width="${width}" height="${height * 0.45}" fill="url(#bottomFade)"/>
  <text x="56" y="88" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" letter-spacing="1">${brand}</text>
  <rect x="56" y="108" rx="14" ry="14" width="120" height="40" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.55)" stroke-width="1.5"/>
  <text x="74" y="136" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700" letter-spacing="2">${mode}</text>
  <text x="56" y="${height - 220}" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="56" font-weight="700">${line1}</text>
  ${line2 ? `<text x="56" y="${height - 150}" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="56" font-weight="700">${line2}</text>` : ''}
  <rect x="56" y="${height - 110}" rx="22" ry="22" width="360" height="64" fill="#7C5CFF"/>
  <text x="86" y="${height - 68}" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700" letter-spacing="1">${cta}</text>
  <text x="56" y="${height - 28}" fill="rgba(255,255,255,0.75)" font-family="Arial, Helvetica, sans-serif" font-size="22" letter-spacing="0.5">${url}</text>
</svg>`;
}

export async function composeSocialImageFromPhoto(photoBuffer, concept, { width = SOCIAL_IMAGE_WIDTH, height = SOCIAL_IMAGE_HEIGHT, sharpImpl } = {}) {
  const sharp = sharpImpl || (await import('sharp')).default;

  let photo = sharp(photoBuffer).rotate().resize(width, height, { fit: 'cover', position: 'centre' });

  let logoComposite = null;
  if (fs.existsSync(LOGO_SVG)) {
    const logoBuffer = await sharp(fs.readFileSync(LOGO_SVG)).resize(72, 72).png().toBuffer();
    logoComposite = { input: logoBuffer, top: 36, left: width - 120 };
  }

  const overlaySvg = buildMinimalOverlaySvg({ width, height, concept });
  const composites = [{ input: Buffer.from(overlaySvg), top: 0, left: 0 }];
  if (logoComposite) composites.push(logoComposite);

  const jpeg = await photo
    .composite(composites)
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();

  return { buffer: jpeg, width, height, format: 'jpeg', source: 'photo_overlay' };
}

export async function composeProceduralFallback(concept, opts = {}) {
  const palette = concept.palette || {
    a: '#0B1220',
    b: '#134E4A',
    accent: '#22D3EE'
  };
  return composeSocialImage({ ...concept, palette }, opts);
}
