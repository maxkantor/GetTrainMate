import React, { useCallback, useState } from 'react';
import { Alert, Box, Button, Snackbar, Stack, Typography } from '@mui/material';
import type { EventMatch, EventPrediction } from '@/services/sportsEventLayerService';
import { useI18n } from '@/hooks/useI18n';
import { formatI18n } from '@/i18n';
import { useWcDisplay } from '@/hooks/useWcDisplay';
import { WcTeamLabel } from '@/components/worldCupHub/WcTeamLabel';

type Props = {
  match: EventMatch;
  prediction: EventPrediction;
  onShared?: () => void;
};

function renderShareCardToCanvas(
  scoreLine: string,
  reason: string | undefined,
  title: string,
  footer: string,
  joinCta: string,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 1080, 1080);
  grad.addColorStop(0, '#070b1a');
  grad.addColorStop(0.5, '#1a1040');
  grad.addColorStop(1, '#070b1a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1080, 1080);
  ctx.strokeStyle = 'rgba(99,102,241,0.6)';
  ctx.lineWidth = 4;
  ctx.strokeRect(60, 60, 960, 960);

  ctx.fillStyle = '#a78bfa';
  ctx.font = 'bold 42px Inter, sans-serif';
  ctx.fillText(title, 100, 180);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 56px Inter, sans-serif';
  const words = scoreLine.split(' ');
  let line = '';
  let y = 400;
  for (const w of words) {
    const test = `${line}${w} `;
    if (ctx.measureText(test).width > 880 && line) {
      ctx.fillText(line, 100, y);
      line = `${w} `;
      y += 70;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, 100, y);

  if (reason) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '32px Inter, sans-serif';
    ctx.fillText(`"${reason.slice(0, 80)}${reason.length > 80 ? '…' : ''}"`, 100, y + 100);
  }

  ctx.fillStyle = '#a78bfa';
  ctx.font = '26px Inter, sans-serif';
  ctx.fillText(joinCta, 100, 860);

  ctx.fillStyle = '#6366f1';
  ctx.font = 'bold 32px Inter, sans-serif';
  ctx.fillText(footer, 100, 920);

  return canvas;
}

function canShareWithFiles(file: File): boolean {
  if (!navigator.share || !navigator.canShare) return false;
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export const PredictionShareCard: React.FC<Props> = ({ match, prediction, onShared }) => {
  const { t } = useI18n();
  const { teamName } = useWcDisplay();
  const [notice, setNotice] = useState<string | null>(null);

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/world-cup` : '';
  const teamADisplay = teamName(match.teamAId, match.teamAName);
  const teamBDisplay = teamName(match.teamBId, match.teamBName);
  const vs = t('event_hub.vs');

  const pickLabel =
    prediction.predictionType === 'draw'
      ? t('event_hub.pick_draw')
      : prediction.predictionType === 'exact_score' && prediction.predictedScoreA != null
        ? `${prediction.predictedScoreA}-${prediction.predictedScoreB}`
        : prediction.predictedWinnerTeamId === match.teamAId
          ? teamADisplay
          : teamBDisplay;

  const buildShareText = useCallback((footer: string) =>
    formatI18n(t('event_hub.share_pick_text'), {
      teamA: teamADisplay,
      vs,
      teamB: teamBDisplay,
      pick: pickLabel,
      footer,
    }), [teamADisplay, teamBDisplay, vs, pickLabel, t]);

  const buildCanvasScoreLine = useCallback(() => {
    if (prediction.predictionType === 'exact_score' && prediction.predictedScoreA != null) {
      return `${teamADisplay} ${prediction.predictedScoreA} – ${prediction.predictedScoreB} ${teamBDisplay}`;
    }
    if (prediction.predictionType === 'draw') {
      return `${teamADisplay} ${vs} ${teamBDisplay} · ${t('event_hub.pick_draw')}`;
    }
    return `${teamADisplay} ${vs} ${teamBDisplay}`;
  }, [match, prediction, teamADisplay, teamBDisplay, vs, t]);

  const handleDownload = useCallback(() => {
    const canvas = renderShareCardToCanvas(
      buildCanvasScoreLine(),
      prediction.reason,
      t('event_hub.share_card_title'),
      t('event_hub.share_card_footer'),
      t('event_hub.share_card_join_cta'),
    );
    const link = document.createElement('a');
    link.download = 'world-cup-prediction.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    setNotice(t('event_hub.image_downloaded'));
    onShared?.();
  }, [buildCanvasScoreLine, prediction.reason, t, onShared]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setNotice(t('event_hub.link_copied'));
      onShared?.();
    } catch {
      setNotice(t('event_hub.copy_failed'));
    }
  }, [shareUrl, t, onShared]);

  const handleWebShare = useCallback(async () => {
    const text = buildShareText(t('event_hub.share_card_footer'));
    try {
      const canvas = renderShareCardToCanvas(
        buildCanvasScoreLine(),
        prediction.reason,
        t('event_hub.share_card_title'),
        t('event_hub.share_card_footer'),
        t('event_hub.share_card_join_cta'),
      );
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (blob) {
        const file = new File([blob], 'world-cup-prediction.png', { type: 'image/png' });
        if (canShareWithFiles(file)) {
          await navigator.share({
            title: t('event_hub.share_card_title'),
            text,
            url: shareUrl,
            files: [file],
          });
          onShared?.();
          return;
        }
      }
      if (navigator.share) {
        await navigator.share({ title: t('event_hub.share_card_title'), text, url: shareUrl });
        onShared?.();
        return;
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
    }
    await handleCopyLink();
    setNotice((prev) => prev ?? t('event_hub.share_fallback'));
  }, [buildCanvasScoreLine, buildShareText, prediction.reason, shareUrl, t, onShared, handleCopyLink]);

  const handleShareTwitter = () => {
    const text = encodeURIComponent(buildShareText('gettrainmate.com/world-cup'));
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank', 'noopener,noreferrer');
    onShared?.();
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(`${buildShareText('')} ${shareUrl}`);
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
    onShared?.();
  };

  return (
    <Box sx={{ mt: 2, p: 2, borderRadius: 3, border: '1px solid rgba(99,102,241,0.35)', background: 'rgba(15,18,30,0.85)' }}>
      <Typography variant="subtitle2" color="primary.light" gutterBottom>
        {t('event_hub.share_card_title')}
      </Typography>
      <Typography variant="body1" sx={{ mb: 0.5, fontWeight: 600, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <WcTeamLabel teamId={match.teamAId} fallbackName={match.teamAName} flagEmoji={match.teamAFlag} size={20} />
        <span>{vs}</span>
        <WcTeamLabel teamId={match.teamBId} fallbackName={match.teamBName} flagEmoji={match.teamBFlag} size={20} />
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {t('event_hub.share_card_hint')}
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button size="small" variant="contained" onClick={handleCopyLink}>
          {t('event_hub.copy_link')}
        </Button>
        <Button size="small" variant="outlined" onClick={handleDownload}>
          {t('event_hub.download_image')}
        </Button>
        <Button size="small" variant="outlined" onClick={handleShareTwitter}>
          X
        </Button>
        <Button size="small" variant="outlined" onClick={handleShareWhatsApp}>
          WhatsApp
        </Button>
        {typeof navigator !== 'undefined' && 'share' in navigator && (
          <Button size="small" variant="text" onClick={handleWebShare}>
            {t('event_hub.share')}
          </Button>
        )}
      </Stack>
      <Snackbar
        open={!!notice}
        autoHideDuration={3500}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setNotice(null)} sx={{ width: '100%' }}>
          {notice}
        </Alert>
      </Snackbar>
    </Box>
  );
};
