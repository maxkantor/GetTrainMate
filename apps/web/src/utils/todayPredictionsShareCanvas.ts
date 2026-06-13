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

/** Premium vertical share card for all of today's World Cup picks (WhatsApp / stories). */
export function renderTodayPicksCanvas(
  fanName: string,
  dateLabel: string,
  picks: TodayPickRow[],
  labels: TodayPicksCanvasLabels,
): HTMLCanvasElement {
  const width = 1080;
  const rowHeight = 148;
  const height = Math.min(2400, Math.max(1280, 520 + picks.length * rowHeight));
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

  const glow = ctx.createRadialGradient(width * 0.5, 180, 40, width * 0.5, 180, 420);
  glow.addColorStop(0, 'rgba(99, 102, 241, 0.35)');
  glow.addColorStop(1, 'rgba(99, 102, 241, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, 520);

  ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
  ctx.lineWidth = 3;
  roundRect(ctx, 48, 48, width - 96, height - 96, 36);
  ctx.stroke();

  ctx.fillStyle = 'rgba(251, 191, 36, 0.9)';
  ctx.font = 'bold 28px Inter, system-ui, sans-serif';
  ctx.fillText(labels.eventTitle.toUpperCase(), 96, 120);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 64px Inter, system-ui, sans-serif';
  const nameLine = fanName.trim() || 'Fan';
  ctx.fillText(nameLine, 96, 210);

  ctx.fillStyle = 'rgba(167, 139, 250, 0.95)';
  ctx.font = '600 36px Inter, system-ui, sans-serif';
  ctx.fillText(labels.subtitle, 96, 268);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.font = '500 30px Inter, system-ui, sans-serif';
  ctx.fillText(dateLabel, 96, 318);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.font = 'bold 26px Inter, system-ui, sans-serif';
  ctx.fillText(labels.picksHeading.toUpperCase(), 96, 380);

  let y = 420;
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
