import { loadFlagImageMap } from '@/utils/teamFlags';
import { loadWcTrophyImage } from '@/utils/wcTrophyAsset';

export type TournamentShareTeam = {
  teamId: string;
  name: string;
};

export type TournamentBracketShareData = {
  semifinalists: TournamentShareTeam[];
  champion: TournamentShareTeam;
  thirdPlace: TournamentShareTeam;
};

export type TournamentBracketShareLabels = {
  eventTitle: string;
  subtitle: string;
  semifinalsHeading: string;
  championHeading: string;
  thirdHeading: string;
  footer: string;
  footerMadeOn: string;
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
    ctx.drawImage(avatarImg, sx, sy, size, size, cx - radius, cy - radius, radius * 2, radius * 2);
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
    ctx.fillText((fanName.trim().charAt(0) || '?').toUpperCase(), cx, cy + 2);
  }
  ctx.restore();

  ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
}

function drawTeamRow(
  ctx: CanvasRenderingContext2D,
  team: TournamentShareTeam,
  flagMap: Map<string, HTMLImageElement>,
  x: number,
  y: number,
  accent: string,
) {
  const flagH = 32;
  const img = flagMap.get(team.teamId.trim().toLowerCase());
  if (img) {
    const w = flagH * (img.width / img.height);
    ctx.drawImage(img, x, y - flagH / 2, w, flagH);
    x += w + 16;
  }
  ctx.fillStyle = accent;
  ctx.font = 'bold 32px Inter, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const name = team.name.length > 22 ? `${team.name.slice(0, 21)}…` : team.name;
  ctx.fillText(name, x, y);
}

/** Premium share card for tournament bracket picks (semi-finalists + champion + 3rd). */
export async function renderTournamentBracketShareCanvas(
  fanName: string,
  data: TournamentBracketShareData,
  labels: TournamentBracketShareLabels,
  avatarImg?: HTMLImageElement | null,
): Promise<HTMLCanvasElement> {
  const width = 1080;
  const borderInset = 48;
  const rowH = 52;
  const sectionGap = 36;
  const teamIds = [
    ...data.semifinalists.map((t) => t.teamId),
    data.champion.teamId,
    data.thirdPlace.teamId,
  ];
  const flagMap = await loadFlagImageMap(teamIds, 40);
  const trophyImg = await loadWcTrophyImage();

  const semiBlock = 40 + data.semifinalists.length * (rowH + 12);
  const championBlock = 40 + rowH + 16;
  const thirdBlock = 40 + rowH + 16;
  const footerSpace = 140;
  const headerHeight = 380;
  const height = headerHeight + semiBlock + sectionGap + championBlock + sectionGap + thirdBlock + footerSpace;

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

  ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
  ctx.lineWidth = 3;
  roundRect(ctx, borderInset, borderInset, width - borderInset * 2, height - borderInset * 2, 36);
  ctx.stroke();

  const trophyH = 88;
  const trophyTop = borderInset + 36;
  if (trophyImg) {
    const trophyW = trophyH * (trophyImg.width / trophyImg.height);
    ctx.save();
    ctx.shadowColor = 'rgba(251, 191, 36, 0.75)';
    ctx.shadowBlur = 32;
    ctx.drawImage(trophyImg, (width - trophyW) / 2, trophyTop, trophyW, trophyH);
    ctx.restore();
  }

  const eventTitleY = trophyTop + trophyH + 28;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(251, 191, 36, 0.95)';
  ctx.font = 'bold 28px Inter, system-ui, sans-serif';
  ctx.fillText(labels.eventTitle.toUpperCase(), width / 2, eventTitleY);

  const dividerY = eventTitleY + 28;
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(96, dividerY);
  ctx.lineTo(width - 96, dividerY);
  ctx.stroke();

  const avatarRadius = 44;
  const identityRowY = dividerY + 36 + avatarRadius;
  const avatarCx = borderInset + avatarRadius + 8;
  drawAvatar(ctx, fanName, avatarImg ?? null, avatarCx, identityRowY, avatarRadius);

  const textX = borderInset + avatarRadius * 2 + 40;
  const displayName = (fanName.trim() || 'Fan').length > 16
    ? `${fanName.trim().slice(0, 15)}…`
    : (fanName.trim() || 'Fan');

  ctx.textAlign = 'left';
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 42px Inter, system-ui, sans-serif';
  ctx.fillText(displayName, textX, identityRowY - 14);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = '500 24px Inter, system-ui, sans-serif';
  ctx.fillText(labels.subtitle, textX, identityRowY + 28);

  let y = headerHeight;

  const drawSection = (heading: string, accent: string) => {
    ctx.fillStyle = accent;
    ctx.font = 'bold 22px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(heading.toUpperCase(), 96, y);
    y += 40;
  };

  drawSection(labels.semifinalsHeading, 'rgba(167, 139, 250, 0.95)');
  for (const team of data.semifinalists) {
    roundRect(ctx, 80, y - 28, width - 160, rowH + 8, 16);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.fill();
    drawTeamRow(ctx, team, flagMap, 108, y + 4, '#f8fafc');
    y += rowH + 12;
  }

  y += sectionGap;
  drawSection(labels.championHeading, 'rgba(251, 191, 36, 0.95)');
  roundRect(ctx, 80, y - 28, width - 160, rowH + 8, 16);
  ctx.fillStyle = 'rgba(251, 191, 36, 0.1)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();
  drawTeamRow(ctx, data.champion, flagMap, 108, y + 4, '#fde68a');
  y += rowH + 16 + sectionGap;

  drawSection(labels.thirdHeading, 'rgba(180, 130, 90, 0.95)');
  roundRect(ctx, 80, y - 28, width - 160, rowH + 8, 16);
  ctx.fillStyle = 'rgba(180, 130, 90, 0.1)';
  ctx.fill();
  drawTeamRow(ctx, data.thirdPlace, flagMap, 108, y + 4, '#fcd9b6');
  y += rowH + 16;

  ctx.fillStyle = '#a78bfa';
  ctx.font = '600 28px Inter, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(labels.footerMadeOn, 96, y + 48);
  ctx.fillStyle = '#6366f1';
  ctx.font = 'bold 30px Inter, system-ui, sans-serif';
  ctx.fillText(labels.footer, 96, y + 90);

  return canvas;
}
