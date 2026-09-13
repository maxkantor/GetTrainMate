/**
 * Premium unified GetTrainMate social creative.
 * TRAIN / VIBE / DATE rotate, but every card must look like the same product.
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

const MODE_PROMISE = {
  TRAIN: 'TRAIN WITH PEOPLE WHO PUSH YOU.',
  VIBE: 'FIND YOUR PEOPLE. DO MORE TOGETHER.',
  DATE: 'ACTIVE PEOPLE. REAL CHEMISTRY.'
};

function escapeXml(value) {
  return String(value || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}

function splitHeadline(value) {
  const words = String(value || 'FIND YOUR PEOPLE').trim().split(/\s+/).filter(Boolean);
  if (words.length <= 4) return [words.join(' ')];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
}

export function buildMinimalOverlaySvg({ width, height, concept }) {
  const modeRaw = String(concept.mode || 'TRAIN').toUpperCase();
  const mode = escapeXml(modeRaw);
  const promise = escapeXml(MODE_PROMISE[modeRaw] || MODE_PROMISE.TRAIN);
  const lines = splitHeadline(concept.imageHeadline || 'Find Your People').map(escapeXml);
  const ctaRaw = String(concept.cta || 'START CONNECTING').toUpperCase();
  const cta = escapeXml(ctaRaw);
  const ctaWidth = Math.min(430, Math.max(280, 95 + ctaRaw.length * 15));
  const line2 = lines[1] ? `<text x="64" y="${height - 338}" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="800">${lines[1]}</text>` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="leftPanel" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#070912" stop-opacity="0.96"/>
      <stop offset="68%" stop-color="#070912" stop-opacity="0.80"/>
      <stop offset="100%" stop-color="#070912" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="bottomFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="56%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.68"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${Math.round(width * 0.67)}" height="${height}" fill="url(#leftPanel)"/>
  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#bottomFade)"/>
  <rect x="64" y="62" width="7" height="48" rx="3" fill="#7C5CFF"/>
  <text x="88" y="96" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="800">GetTrainMate</text>
  <text x="64" y="145" fill="#B9AEFF" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="700" letter-spacing="3">TRAIN  •  VIBE  •  DATE</text>
  <rect x="64" y="190" rx="18" width="150" height="48" fill="#7C5CFF"/>
  <text x="139" y="222" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="800" letter-spacing="2">${mode}</text>
  <text x="64" y="310" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="31" font-weight="700">${promise}</text>
  <text x="64" y="${height - 410}" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="800">${lines[0]}</text>
  ${line2}
  <rect x="64" y="${height - 245}" rx="30" width="${ctaWidth}" height="70" fill="#7C5CFF"/>
  <text x="${64 + ctaWidth / 2}" y="${height - 199}" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="800" letter-spacing="0.7">${cta}</text>
  <text x="64" y="${height - 125}" fill="rgba(255,255,255,0.92)" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="600">gettrainmate.com</text>
  <text x="64" y="${height - 82}" fill="rgba(255,255,255,0.66)" font-family="Arial, Helvetica, sans-serif" font-size="19">Train together. Meet people. Build real connections.</text>
</svg>`;
}

export async function composeSocialImageFromPhoto(photoBuffer, concept, { width = SOCIAL_IMAGE_WIDTH, height = SOCIAL_IMAGE_HEIGHT, sharpImpl } = {}) {
  const sharp = sharpImpl || (await import('sharp')).default;
  const photo = sharp(photoBuffer).rotate().resize(width, height, { fit:'cover', position:'right' }).modulate({ brightness:0.98, saturation:1.06 }).linear(1.04,-4);
  let logoComposite = null;
  if (fs.existsSync(LOGO_SVG)) {
    const logoBuffer = await sharp(fs.readFileSync(LOGO_SVG)).resize(76,76).png().toBuffer();
    logoComposite = { input: logoBuffer, top: 42, left: width - 120 };
  }
  const composites = [{ input: Buffer.from(buildMinimalOverlaySvg({ width, height, concept })), top:0, left:0 }];
  if (logoComposite) composites.push(logoComposite);
  const jpeg = await photo.composite(composites).jpeg({ quality:90, mozjpeg:true }).toBuffer();
  return { buffer:jpeg, width, height, format:'jpeg', source:'photo_overlay', layoutId:'GTM_UNIFIED' };
}

export async function composeProceduralFallback(concept, opts = {}) {
  return composeSocialImage({ ...concept, palette: concept.palette || { a:'#0B1220', b:'#24184D', accent:'#7C5CFF' } }, opts);
}
