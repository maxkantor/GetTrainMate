export type TodayPickRow = {
  teamAFlag: string;
  teamAName: string;
  teamBName: string;
  teamBFlag: string;
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

/** Premium vertical share card for all of today's World Cup picks (WhatsApp / stories). */
export async function renderTodayPicksCanvas(
  fanName: string,
  dateLabel: string,
  picks: TodayPickRow[],
  labels: TodayPicksCanvasLabels,
  avatarImg?: HTMLImageElement | null,
): Promise<HTMLCanvasElement> {
  const width = 1080;
  const rowHeight = 148;
  const headerHeight = 400;
  const height = Math.min(2400, Math.max(1280, headerHeight + picks.length * rowHeight + 120));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

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
    roundRect(ctx, 80, y, width - 160, rowHeight - 16, 22);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px Inter, system-ui, sans-serif';
    const matchup = `${pick.teamAFlag} ${pick.teamAName}  vs  ${pick.teamBName} ${pick.teamBFlag}`;
    ctx.fillText(matchup.length > 42 ? `${matchup.slice(0, 39)}…` : matchup, 108, y + 52);

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 32px Inter, system-ui, sans-serif';
    ctx.fillText(`→ ${pick.pickLabel}`, 108, y + 98);

    if (pick.scoreLine) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.font = '500 26px Inter, system-ui, sans-serif';
      ctx.fillText(pick.scoreLine, 108, y + 128);
    }

    y += rowHeight;
  }

  ctx.fillStyle = '#6366f1';
  ctx.font = 'bold 32px Inter, system-ui, sans-serif';
  ctx.fillText(labels.footer, 96, height - 88);

  return canvas;
}

export async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

export function canvasToDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png');
}
