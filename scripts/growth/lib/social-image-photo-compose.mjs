/**
 * Photo-first GetTrainMate social creative.
 * TRAIN / VIBE / DATE share one visual system, but the people and activity stay dominant.
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

const MODE_COPY = {
  TRAIN: { promise: 'TRAIN WITH PEOPLE WHO PUSH YOU.', cta: 'FIND A TRAINMATE' },
  VIBE: { promise: 'FIND YOUR PEOPLE. DO MORE TOGETHER.', cta: 'FIND YOUR PEOPLE' },
  DATE: { promise: 'ACTIVE PEOPLE. REAL CHEMISTRY.', cta: 'MEET SOMEONE ACTIVE' }
};

function escapeXml(value) {
  return String(value || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}

function splitHeadline(value) {
  const words = String(value || 'FIND YOUR PEOPLE').trim().split(/\s+/).filter(Boolean);
  if (words.length <= 5) return [words.join(' ')];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
}

export function buildMinimalOverlaySvg({ width, height, concept }) {
  const modeRaw = String(concept.mode || 'TRAIN').toUpperCase();
  const copy = MODE_COPY[modeRaw] || MODE_COPY.TRAIN;
  const headlineLines = splitHeadline(concept.imageHeadline || copy.promise).slice(0, 2).map(escapeXml);
  const ctaRaw = String(concept.cta || copy.cta).toUpperCase();
  const cta = escapeXml(ctaRaw);
  const ctaW = Math.min(420, Math.max(250, 82 + ctaRaw.length * 13));
  const accent = '#7C5CFF';
  const margin = 56;
  const headlineFont = headlineLines.some(x => x.length > 18) ? 52 : 58;
  const line1Y = height - 260;
  const line2Y = line1Y + 62;
  const ctaY = height - 105;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="topFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#060812" stop-opacity="0.58"/><stop offset="100%" stop-color="#060812" stop-opacity="0"/></linearGradient>
      <linearGradient id="bottomFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#060812" stop-opacity="0"/><stop offset="58%" stop-color="#060812" stop-opacity="0.12"/><stop offset="100%" stop-color="#060812" stop-opacity="0.88"/></linearGradient>
    </defs>
    <rect width="${width}" height="180" fill="url(#topFade)"/>
    <rect width="${width}" height="${height}" fill="url(#bottomFade)"/>
    <rect x="${margin}" y="48" width="7" height="42" rx="3" fill="${accent}"/>
    <text x="${margin + 21}" y="79" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="29" font-weight="800">GetTrainMate</text>
    <text x="${margin}" y="118" fill="#C8BEFF" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="800" letter-spacing="2.3">TRAIN • VIBE • DATE</text>
    <rect x="${width - margin - 130}" y="48" width="130" height="44" rx="22" fill="${accent}"/>
    <text x="${width - margin - 65}" y="77" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="900" letter-spacing="1.5">${escapeXml(modeRaw)}</text>
    <text x="${margin}" y="${line1Y}" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="${headlineFont}" font-weight="900" letter-spacing="-0.7">${headlineLines[0] || ''}</text>
    ${headlineLines[1] ? `<text x="${margin}" y="${line2Y}" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="${headlineFont}" font-weight="900" letter-spacing="-0.7">${headlineLines[1]}</text>` : ''}
    <text x="${margin}" y="${headlineLines[1] ? line2Y + 45 : line1Y + 45}" fill="rgba(255,255,255,0.86)" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="600">${escapeXml(copy.promise)}</text>
    <rect x="${width - margin - ctaW}" y="${ctaY}" width="${ctaW}" height="58" rx="29" fill="${accent}"/>
    <text x="${width - margin - ctaW / 2}" y="${ctaY + 38}" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="900">${cta}</text>
    <text x="${margin}" y="${ctaY + 38}" fill="rgba(255,255,255,0.92)" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700">gettrainmate.com</text>
  </svg>`;
}

export async function composeSocialImageFromPhoto(photoBuffer, concept, { width = SOCIAL_IMAGE_WIDTH, height = SOCIAL_IMAGE_HEIGHT, sharpImpl } = {}) {
  const sharp = sharpImpl || (await import('sharp')).default;
  const photo = sharp(photoBuffer).rotate().resize(width, height, { fit:'cover', position:'centre' }).modulate({ brightness:1.0, saturation:1.04 }).linear(1.02,-2);
  let logoComposite = null;
  if (fs.existsSync(LOGO_SVG)) {
    const logoBuffer = await sharp(fs.readFileSync(LOGO_SVG)).resize(66,66).png().toBuffer();
    logoComposite = { input: logoBuffer, top: 34, left: width - 116 };
  }
  const composites = [{ input: Buffer.from(buildMinimalOverlaySvg({ width, height, concept })), top:0, left:0 }];
  if (logoComposite) composites.push(logoComposite);
  const jpeg = await photo.composite(composites).jpeg({ quality:91, mozjpeg:true }).toBuffer();
  return { buffer:jpeg, width, height, format:'jpeg', source:'photo_overlay', layoutId:'GTM_PHOTO_FIRST' };
}

export async function composeProceduralFallback(concept, opts = {}) {
  return composeSocialImage({ ...concept, palette: concept.palette || { a:'#0B1220', b:'#24184D', accent:'#7C5CFF' } }, opts);
}
