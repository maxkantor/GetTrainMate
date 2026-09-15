/**
 * Premium photo-first GetTrainMate social creative.
 * Brand invariant: TRAIN → VIBE → DATE on every creative.
 * - full-bleed lifestyle photography dominates
 * - journey mode strip (emphasized mode highlighted)
 * - ONE headline (+ optional short support line)
 * - CTA line + URL (no fake buttons)
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
    headline: 'TRAIN TOGETHER.\nSEE WHERE IT GOES.',
    subheadline: 'Start with fitness. Stay for the connection.'
  },
  VIBE: {
    headline: 'THE MATCH ENDS.\nTHE CONNECTION DOESN\'T HAVE TO.',
    subheadline: 'Meet through what you already love doing.'
  },
  DATE: {
    headline: 'START WITH A WORKOUT.\nSEE WHAT HAPPENS.',
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
  const raw = String(value || '').trim();
  if (raw.includes('\n')) {
    return raw.split(/\n+/).map((l) => l.trim()).filter(Boolean).slice(0, 2);
  }
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length <= 4) return [words.join(' ')];
  const target = Math.ceil(words.length / 2);
  return [words.slice(0, target).join(' '), words.slice(target).join(' ')].filter(Boolean);
}

function modeJourneyRow(emphasize, { x = 48, y = 108 } = {}) {
  const modes = ['TRAIN', 'VIBE', 'DATE'];
  let cursor = x;
  const parts = [];
  for (let i = 0; i < modes.length; i++) {
    const m = modes[i];
    const on = m === String(emphasize || '').toUpperCase();
    parts.push(
      `<text x="${cursor}" y="${y}" fill="${on ? '#C084FC' : 'rgba(255,255,255,0.72)'}" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="${on ? 800 : 600}" letter-spacing="2">${m}</text>`
    );
    cursor += m.length * 11 + 8;
    if (i < modes.length - 1) {
      parts.push(
        `<text x="${cursor}" y="${y}" fill="rgba(255,255,255,0.45)" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="600">→</text>`
      );
      cursor += 22;
    }
  }
  return parts.join('\n');
}

/**
 * Journey overlay: brand + TRAIN→VIBE→DATE + headline + support + CTA + URL.
 */
export function buildMinimalOverlaySvg({ width, height, concept }) {
  const mode = String(concept.mode || 'TRAIN').toUpperCase();
  const copy = MODE_COPY[mode] || MODE_COPY.TRAIN;
  const headline = concept.imageHeadline && !/feed|scroll|weekend is empty|same energy\. now say hi/i.test(String(concept.imageHeadline))
    ? String(concept.imageHeadline)
    : copy.headline;
  const subheadlineRaw = concept.imageSubheadline != null
    ? String(concept.imageSubheadline)
    : copy.subheadline;
  const subheadline = subheadlineRaw && subheadlineRaw.length <= 80 ? subheadlineRaw : '';
  const lines = splitHeadline(headline).slice(0, 2).map(escapeXml);
  const margin = 48;
  const long = lines.some((line) => line.length > 24);
  const headlineSize = long ? 42 : 50;
  const line1Y = height - 220;
  const line2Y = line1Y + (lines[1] ? 52 : 0);
  const subY = (lines[1] ? line2Y : line1Y) + 46;
  const journeyY = subY + 40;
  const ctaY = height - 52;
  const cta = escapeXml(concept.cta && String(concept.cta).length <= 28 ? concept.cta : 'FIND YOUR PEOPLE');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="topShade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#05060B" stop-opacity="0.48"/>
        <stop offset="100%" stop-color="#05060B" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="bottomShade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#05060B" stop-opacity="0"/>
        <stop offset="40%" stop-color="#05060B" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="#05060B" stop-opacity="0.82"/>
      </linearGradient>
    </defs>

    <rect width="${width}" height="150" fill="url(#topShade)"/>
    <rect y="${height * 0.52}" width="${width}" height="${height * 0.48}" fill="url(#bottomShade)"/>

    <text x="${margin}" y="72" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="800">GetTrainMate</text>
    ${modeJourneyRow(mode, { x: margin, y: 108 })}

    <text x="${margin}" y="${line1Y}" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="${headlineSize}" font-weight="900" letter-spacing="-0.6">${lines[0] || ''}</text>
    ${lines[1] ? `<text x="${margin}" y="${line2Y}" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="${headlineSize}" font-weight="900" letter-spacing="-0.6">${lines[1]}</text>` : ''}
    ${subheadline ? `<text x="${margin}" y="${subY}" fill="rgba(255,255,255,0.88)" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="600">${escapeXml(subheadline)}</text>` : ''}
    <text x="${margin}" y="${journeyY}" fill="rgba(255,255,255,0.7)" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="700" letter-spacing="1.5">TRAIN  →  VIBE  →  DATE</text>
    <text x="${margin}" y="${ctaY}" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="800" letter-spacing="1.2">${cta}</text>
    <text x="${margin + 280}" y="${ctaY}" fill="rgba(255,255,255,0.75)" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="700">gettrainmate.com</text>
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

  const buffer = await photo
    .composite(composites)
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();

  return { buffer, width, height };
}
