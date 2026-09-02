/**
 * Programmatic branded social image composition (1080x1350 primary).
 * Text is rendered via SVG overlay — never AI-generated typography.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { wrapHeadlineLines } from './social-image-concept.mjs';

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

function seededNoiseOpacity(seed) {
  return 0.08 + (seed % 7) * 0.015;
}

export function buildBackgroundSvg({ width, height, palette, seed = 0, visualConcept = '' }) {
  const angle = 115 + (seed % 50);
  const accentOpacity = seededNoiseOpacity(seed);
  const orbX = 180 + (seed % 420);
  const orbY = 220 + (seed % 500);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%" gradientTransform="rotate(${angle} 0.5 0.5)">
      <stop offset="0%" stop-color="${palette.a}"/>
      <stop offset="55%" stop-color="${palette.b}"/>
      <stop offset="100%" stop-color="#05070D"/>
    </linearGradient>
    <radialGradient id="orb" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${palette.accent}" stop-opacity="${accentOpacity}"/>
      <stop offset="100%" stop-color="${palette.accent}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000" stop-opacity="0.15"/>
      <stop offset="45%" stop-color="#000" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.72"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <circle cx="${orbX}" cy="${orbY}" r="420" fill="url(#orb)"/>
  <circle cx="${width - orbX * 0.4}" cy="${height - orbY * 0.35}" r="320" fill="url(#orb)" opacity="0.7"/>
  <rect width="${width}" height="${height}" fill="url(#fade)"/>
  <text x="72" y="${height - 96}" fill="${palette.accent}" opacity="0.35" font-family="Arial, Helvetica, sans-serif" font-size="22" letter-spacing="2">${escapeXml(String(visualConcept).slice(0, 48))}</text>
</svg>`;
}

export function buildOverlaySvg({
  width,
  height,
  concept,
  headlineLines,
  logoMarkup = ''
}) {
  const mode = escapeXml(concept.mode || 'TRAIN');
  const sub = escapeXml(concept.imageSubheadline || '');
  const cta = escapeXml(concept.cta || 'Join GetTrainMate');
  const brand = escapeXml('gettrainmate.com');
  const safeTop = 120;
  const headlineY = 430;
  const lineHeight = 92;
  const headlineSvg = headlineLines
    .map(
      (line, i) =>
        `<text x="90" y="${headlineY + i * lineHeight}" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="72" font-weight="700">${escapeXml(line)}</text>`
    )
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <g>
    ${logoMarkup}
    <rect x="90" y="${safeTop + 40}" rx="18" ry="18" width="170" height="52" fill="rgba(255,255,255,0.12)" stroke="${concept.palette?.accent || '#C084FC'}" stroke-width="2"/>
    <text x="110" y="${safeTop + 74}" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700" letter-spacing="2">${mode}</text>
    <text x="90" y="${safeTop + 130}" fill="#D6DAE6" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="500">${sub}</text>
    ${headlineSvg}
    <rect x="90" y="${height - 290}" rx="28" ry="28" width="520" height="86" fill="${concept.palette?.accent || '#7C5CFF'}"/>
    <text x="130" y="${height - 238}" fill="#081018" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700">${cta}</text>
    <text x="90" y="${height - 130}" fill="#A8B0C2" font-family="Arial, Helvetica, sans-serif" font-size="28" letter-spacing="1">${brand}</text>
  </g>
</svg>`;
}

export async function composeSocialImage(concept, { width = SOCIAL_IMAGE_WIDTH, height = SOCIAL_IMAGE_HEIGHT, sharpImpl } = {}) {
  const sharp = sharpImpl || (await import('sharp')).default;
  const headlineLines = wrapHeadlineLines(concept.imageHeadline, { maxCharsPerLine: 20, maxLines: 3 });
  const backgroundSvg = buildBackgroundSvg({
    width,
    height,
    palette: concept.palette,
    seed: concept.backgroundSeed || 0,
    visualConcept: concept.visualConcept
  });

  let logoComposite = null;
  if (fs.existsSync(LOGO_SVG)) {
    const logoBuffer = await sharp(fs.readFileSync(LOGO_SVG)).resize(120, 120).png().toBuffer();
    logoComposite = { input: logoBuffer, top: 110, left: width - 210 };
  }

  const overlaySvg = buildOverlaySvg({
    width,
    height,
    concept,
    headlineLines,
    logoMarkup: ''
  });

  const background = await sharp(Buffer.from(backgroundSvg)).png().toBuffer();
  const composites = [{ input: Buffer.from(overlaySvg), top: 0, left: 0 }];
  if (logoComposite) composites.push(logoComposite);

  const jpeg = await sharp(background)
    .composite(composites)
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();

  return {
    buffer: jpeg,
    width,
    height,
    headlineLines,
    format: 'jpeg'
  };
}

export async function composeSocialImageSquare(concept, opts = {}) {
  return composeSocialImage(concept, { ...opts, width: 1080, height: 1080 });
}
