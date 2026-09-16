/**
 * Premium photo-first GetTrainMate social creative.
 * Permanent hierarchy (2026-09-15 standard):
 * 1) photo (people + activity + connection)
 * 2) large headline
 * 3) TRAIN → VIBE → DATE (clearly readable)
 * 4) CTA
 * 5) optional support (drop if tight)
 * 6) URL
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
    headline: "THE MATCH ENDS.\nTHE CONNECTION DOESN'T HAVE TO.",
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
    return raw.split(/\n+/).map((l) => l.trim()).filter(Boolean).slice(0, 3);
  }
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length <= 4) return [words.join(' ')];
  const target = Math.ceil(words.length / 2);
  return [words.slice(0, target).join(' '), words.slice(target).join(' ')].filter(Boolean);
}

function journeySignature({ x, y, emphasize, size = 22 }) {
  const modes = ['TRAIN', 'VIBE', 'DATE'];
  let cursor = x;
  const parts = [];
  for (let i = 0; i < modes.length; i++) {
    const m = modes[i];
    const on = m === String(emphasize || '').toUpperCase();
    parts.push(
      `<text x="${cursor}" y="${y}" fill="${on ? '#C084FC' : '#FFFFFF'}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${on ? 800 : 700}" letter-spacing="1.5">${m}</text>`
    );
    cursor += m.length * (size * 0.72) + 6;
    if (i < modes.length - 1) {
      parts.push(
        `<text x="${cursor}" y="${y}" fill="rgba(255,255,255,0.55)" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="700">→</text>`
      );
      cursor += size * 0.95;
    }
  }
  return parts.join('\n');
}

/**
 * Journey overlay per permanent creative standard.
 */
export function buildMinimalOverlaySvg({ width, height, concept }) {
  const mode = String(concept.mode || 'TRAIN').toUpperCase();
  const copy = MODE_COPY[mode] || MODE_COPY.TRAIN;
  const headline = concept.imageHeadline && !/feed|scroll|weekend is empty|same energy\. now say hi/i.test(String(concept.imageHeadline))
    ? String(concept.imageHeadline)
    : copy.headline;
  const lines = splitHeadline(headline).slice(0, 3).map(escapeXml);
  const longHeadline = lines.length >= 3 || lines.some((line) => line.length > 24);
  const includeSupport = Boolean(
    concept.imageSubheadline &&
      String(concept.imageSubheadline).length <= 70 &&
      !longHeadline
  );
  const support = includeSupport
    ? escapeXml(concept.imageSubheadline)
    : '';

  const margin = 48;
  const headlineSize = longHeadline ? 40 : lines.some((l) => l.length > 22) ? 44 : 50;
  const lineGap = headlineSize + 8;
  const blockBottom = 56;
  const ctaY = height - blockBottom;
  const urlY = height - 28;
  const journeyY = ctaY - 50;
  const supportY = journeyY - 44;
  // Keep a full text-line gap between headline and optional support.
  const headlineBottomY = support ? supportY - 38 : journeyY - 36;
  const line1Y = headlineBottomY - (lines.length - 1) * lineGap;

  let ctaRaw = String(concept.cta || 'FIND YOUR PEOPLE →').trim();
  if (!/→$/.test(ctaRaw) && /FIND YOUR PEOPLE|FIND A TRAINMATE|MEET YOUR PEOPLE|START CONNECTING/i.test(ctaRaw)) {
    ctaRaw = `${ctaRaw.replace(/\s*→\s*$/, '')} →`;
  }
  if (/learn more|click here|discover more/i.test(ctaRaw)) ctaRaw = 'FIND YOUR PEOPLE →';
  const cta = escapeXml(ctaRaw);

  const lineEls = lines
    .map(
      (line, i) =>
        `<text x="${margin}" y="${line1Y + i * lineGap}" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="${headlineSize}" font-weight="900" letter-spacing="-0.6">${line}</text>`
    )
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="topShade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#05060B" stop-opacity="0.38"/>
        <stop offset="100%" stop-color="#05060B" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="bottomShade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#05060B" stop-opacity="0"/>
        <stop offset="35%" stop-color="#05060B" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="#05060B" stop-opacity="0.78"/>
      </linearGradient>
    </defs>

    <rect width="${width}" height="120" fill="url(#topShade)"/>
    <rect y="${height * 0.55}" width="${width}" height="${height * 0.45}" fill="url(#bottomShade)"/>

    <text x="${margin}" y="68" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="800">GetTrainMate</text>

    ${lineEls}
    ${support ? `<text x="${margin}" y="${supportY}" fill="rgba(255,255,255,0.88)" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="600">${support}</text>` : ''}
    ${journeySignature({ x: margin, y: journeyY, emphasize: mode, size: 22 })}
    <text x="${margin}" y="${ctaY}" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="800" letter-spacing="1.1">${cta}</text>
    <text x="${margin}" y="${urlY}" fill="rgba(255,255,255,0.78)" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="700">gettrainmate.com</text>
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
