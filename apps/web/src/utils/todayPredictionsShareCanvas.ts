import { loadFlagImageMap } from '@/utils/teamFlags';

export type TodayPickRow = {
  teamAId: string;
  teamBId: string;
  teamAName: string;
  teamBName: string;
  pickLabel: string;
  scoreLine?: string;
};

export type TodayPicksCanvasLabels = {
  eventTitle: string;
  subtitle: string;
  picksHeading: string;
  footer: string;
};

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawAvatar(
  ctx: CanvasRenderingContext2D,
  fanName: string,
  avatarImg: HTMLImageElement | null,
  cx: number,
  cy: number,
  radius: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  if (avatarImg) {
    const size = Math.min(avatarImg.width, avatarImg.height);
    const sx = (avatarImg.width - size) / 2;
    const sy = (avatarImg.height - size) / 2;
    ctx.drawImage(
      avatarImg,
      sx,
      sy,
      size,
      size,
      cx - radius,
      cy - radius,
      radius * 2,
      radius * 2,
    );
  } else {
    const grad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
    grad.addColorStop(0, '#6366f1');
    grad.addColorStop(1, '#a855f7');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(radius * 1.1)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const initial = (fanName.trim().charAt(0) || '?').toUpperCase();
    ctx.fillText(initial, cx, cy + 2);
  }
  ctx.restore();

  ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
}

function drawMatchupLine(
  ctx: CanvasRenderingContext2D,
  pick: TodayPickRow,
  flagMap: Map<string, HTMLImageElement>,
  x: number,
  y: number,
  layout: PickCardLayout,
) {
  const flagH = layout.flagH;
  const gap = 12;
  let cursorX = x;

  ctx.fillStyle = '#ffffff';
  ctx.font = layout.matchupFont;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const shorten = (name: string, max = 20) => (name.length > max ? `${name.slice(0, max - 1)}…` : name);

  const drawFlag = (teamId: string) => {
    const img = flagMap.get(teamId.trim().toLowerCase());
    if (!img) return;
    const w = flagH * (img.width / img.height);
    ctx.drawImage(img, cursorX, y - flagH / 2, w, flagH);
    cursorX += w + gap;
  };

  const drawText = (text: string) => {
    ctx.fillText(text, cursorX, y);
    cursorX += ctx.measureText(text).width + gap;
  };

  drawFlag(pick.teamAId);
  drawText(shorten(pick.teamAName));
  drawText('vs');
  drawText(shorten(pick.teamBName));
  drawFlag(pick.teamBId);
}

/** Measured line box height — avoids canvas font metrics overlapping the next line. */
function textLineHeight(ctx: CanvasRenderingContext2D, font: string, sample = 'Ag') {
  ctx.font = font;
  const m = ctx.measureText(sample);
  const ascent = m.actualBoundingBoxAscent;
  const descent = m.actualBoundingBoxDescent;
  if (ascent > 0 && descent >= 0) {
    return ascent + descent;
  }
  const size = Number.parseInt(font, 10) || 24;
  return Math.ceil(size * 1.45);
}

type PickCardLayout = {
  cardPadTop: number;
  cardPadBottom: number;
  pickFont: string;
  scoreFont: string;
  matchupFont: string;
  pickLineGap: number;
  matchupBlock: number;
  cardGap: number;
  flagH: number;
};

function layoutForPickCount(count: number): PickCardLayout {
  if (count >= 6) {
    return {
      cardPadTop: 20,
      cardPadBottom: 28,
      pickFont: 'bold 22px Inter, system-ui, sans-serif',
      scoreFont: '500 18px Inter, system-ui, sans-serif',
      matchupFont: 'bold 28px Inter, system-ui, sans-serif',
      pickLineGap: 20,
      matchupBlock: 44,
      cardGap: 16,
      flagH: 24,
    };
  }
  if (count >= 4) {
    return {
      cardPadTop: 26,
      cardPadBottom: 36,
      pickFont: 'bold 24px Inter, system-ui, sans-serif',
      scoreFont: '500 20px Inter, system-ui, sans-serif',
      matchupFont: 'bold 30px Inter, system-ui, sans-serif',
      pickLineGap: 24,
      matchupBlock: 50,
      cardGap: 20,
      flagH: 26,
    };
  }
  return {
    cardPadTop: 34,
    cardPadBottom: 48,
    pickFont: 'bold 28px Inter, system-ui, sans-serif',
    scoreFont: '500 22px Inter, system-ui, sans-serif',
    matchupFont: 'bold 34px Inter, system-ui, sans-serif',
    pickLineGap: 32,
    matchupBlock: 56,
    cardGap: 28,
    flagH: 30,
  };
}

function pickCardHeight(
  ctx: CanvasRenderingContext2D,
  pick: TodayPickRow,
  layout: PickCardLayout,
): number {
  let contentBottom = layout.cardPadTop + layout.matchupBlock
    + textLineHeight(ctx, layout.pickFont, `→ ${pick.pickLabel}`);

  if (pick.scoreLine) {
    contentBottom += layout.pickLineGap + textLineHeight(ctx, layout.scoreFont, pick.scoreLine);
  }

  return contentBottom + layout.cardPadBottom;
}

/** Premium vertical share card for all of today's World Cup picks (WhatsApp / stories). */
export async function renderTodayPicksCanvas(
  fanName: string,
  dateLabel: string,
  picks: TodayPickRow[],
  labels: TodayPicksCanvasLabels,
  avatarImg?: HTMLImageElement | null,
): Promise<HTMLCanvasElement> {
  const width = 1080;
  const headerHeight = 400;
  const footerSpace = 120;
  const cardPadX = 108;
  const layout = layoutForPickCount(picks.length);

  const {
    cardPadTop,
    pickFont,
    scoreFont,
    pickLineGap,
    matchupBlock,
    cardGap,
  } = layout;

  const measureCtx = document.createElement('canvas').getContext('2d')!;
  const picksBlockHeight = picks.reduce(
    (sum, pick) => sum + pickCardHeight(measureCtx, pick, layout) + cardGap,
    0,
  ) - (picks.length > 0 ? cardGap : 0);
  const height = headerHeight + picksBlockHeight + footerSpace;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const flagMap = await loadFlagImageMap(
    picks.flatMap((p) => [p.teamAId, p.teamBId]),
    40,
  );

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#030712');
  bg.addColorStop(0.35, '#0f172a');
  bg.addColorStop(0.7, '#1e1b4b');
  bg.addColorStop(1, '#030712');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.5, 200, 40, width * 0.5, 200, 460);
  glow.addColorStop(0, 'rgba(99, 102, 241, 0.35)');
  glow.addColorStop(1, 'rgba(99, 102, 241, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, 560);

  ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
  ctx.lineWidth = 3;
  roundRect(ctx, 48, 48, width - 96, height - 96, 36);
  ctx.stroke();

  ctx.fillStyle = 'rgba(251, 191, 36, 0.9)';
  ctx.font = 'bold 28px Inter, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(labels.eventTitle.toUpperCase(), 96, 108);

  const avatarRadius = 54;
  const avatarCx = 96 + avatarRadius;
  const avatarCy = 200;
  drawAvatar(ctx, fanName, avatarImg ?? null, avatarCx, avatarCy, avatarRadius);

  const textX = avatarCx + avatarRadius + 36;
  const nameLine = fanName.trim() || 'Fan';

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 52px Inter, system-ui, sans-serif';
  ctx.fillText(nameLine.length > 14 ? `${nameLine.slice(0, 13)}…` : nameLine, textX, 178);

  ctx.fillStyle = 'rgba(167, 139, 250, 0.95)';
  ctx.font = '600 32px Inter, system-ui, sans-serif';
  ctx.fillText(labels.subtitle, textX, 228);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.font = '500 26px Inter, system-ui, sans-serif';
  ctx.fillText(dateLabel, textX, 268);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.font = 'bold 26px Inter, system-ui, sans-serif';
  ctx.fillText(labels.picksHeading.toUpperCase(), 96, 330);

  let y = 360;
  for (const pick of picks) {
    const cardHeight = pickCardHeight(ctx, pick, layout);

    roundRect(ctx, 80, y, width - 160, cardHeight, 22);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();

    drawMatchupLine(ctx, pick, flagMap, cardPadX, y + cardPadTop + 18, layout);

    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    const pickY = y + cardPadTop + matchupBlock;
    ctx.fillStyle = '#fbbf24';
    ctx.font = pickFont;
    ctx.fillText(`→ ${pick.pickLabel}`, cardPadX, pickY);

    if (pick.scoreLine) {
      const scoreY = pickY + textLineHeight(ctx, pickFont, `→ ${pick.pickLabel}`) + pickLineGap;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.font = scoreFont;
      ctx.fillText(pick.scoreLine, cardPadX, scoreY);
    }

    y += cardHeight + cardGap;
  }

  const footerY = y - (picks.length > 0 ? cardGap : 0) + 48;
  ctx.fillStyle = '#6366f1';
  ctx.font = 'bold 32px Inter, system-ui, sans-serif';
  ctx.fillText(labels.footer, 96, footerY);

  return canvas;
}

export async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

export function canvasToDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png');
}
