import React, { useCallback, useRef } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import type { EventMatch, EventPrediction } from '@/services/sportsEventLayerService';
import { useI18n } from '@/hooks/useI18n';

type Props = {
  match: EventMatch;
  prediction: EventPrediction;
  onShared?: () => void;
};

function renderShareCardToCanvas(
  match: EventMatch,
  prediction: EventPrediction,
  title: string,
  footer: string
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

  const scoreLine =
    prediction.predictionType === 'exact_score' && prediction.predictedScoreA != null
      ? `${match.teamAFlag ?? ''} ${match.teamAName} ${prediction.predictedScoreA} - ${prediction.predictedScoreB} ${match.teamBName} ${match.teamBFlag ?? ''}`
      : prediction.predictionType === 'draw'
        ? `${match.teamAFlag ?? ''} ${match.teamAName} vs ${match.teamBName} ${match.teamBFlag ?? ''} — Draw`
        : `${match.teamAFlag ?? ''} ${match.teamAName} vs ${match.teamBName} ${match.teamBFlag ?? ''}`;

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 56px Inter, sans-serif';
  const words = scoreLine.split(' ');
  let line = '';
  let y = 400;
  for (const w of words) {
    const test = line + w + ' ';
    if (ctx.measureText(test).width > 880 && line) {
      ctx.fillText(line, 100, y);
      line = w + ' ';
      y += 70;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, 100, y);

  if (prediction.reason) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '32px Inter, sans-serif';
    ctx.fillText(`"${prediction.reason.slice(0, 80)}${prediction.reason.length > 80 ? '…' : ''}"`, 100, y + 100);
  }

  ctx.fillStyle = '#6366f1';
  ctx.font = 'bold 36px Inter, sans-serif';
  ctx.fillText(footer, 100, 920);

  return canvas;
}

export const PredictionShareCard: React.FC<Props> = ({ match, prediction, onShared }) => {
  const { t } = useI18n();
  const cardRef = useRef<HTMLDivElement>(null);

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/world-cup` : '';

  const handleDownload = useCallback(() => {
    const canvas = renderShareCardToCanvas(
      match,
      prediction,
      t('event_hub.share_card_title'),
      t('event_hub.share_card_footer')
    );
    const link = document.createElement('a');
    link.download = 'world-cup-prediction.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    onShared?.();
  }, [match, prediction, t, onShared]);

  const handleCopyLink = useCallback(async () => {
    await navigator.clipboard.writeText(shareUrl);
    onShared?.();
  }, [shareUrl, onShared]);

  const handleWebShare = useCallback(async () => {
    const canvas = renderShareCardToCanvas(
      match,
      prediction,
      t('event_hub.share_card_title'),
      t('event_hub.share_card_footer')
    );
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (navigator.share && blob) {
      const file = new File([blob], 'prediction.png', { type: 'image/png' });
      await navigator.share({
        title: t('event_hub.share_card_title'),
        text: `${match.teamAName} vs ${match.teamBName}`,
        url: shareUrl,
        files: [file],
      });
      onShared?.();
    } else {
      await handleCopyLink();
    }
  }, [match, prediction, shareUrl, t, onShared, handleCopyLink]);

  return (
    <Box ref={cardRef} sx={{ mt: 2, p: 2, borderRadius: 3, border: '1px solid rgba(99,102,241,0.4)', background: 'rgba(15,18,30,0.9)' }}>
      <Typography variant="subtitle2" color="primary.light" gutterBottom>
        {t('event_hub.share_card_title')}
      </Typography>
      <Typography variant="h6" sx={{ mb: 1 }}>
        {match.teamAFlag} {match.teamAName} vs {match.teamBName} {match.teamBFlag}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('event_hub.share_card_footer')}
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button size="small" variant="contained" onClick={handleWebShare}>
          {t('event_hub.share')}
        </Button>
        <Button size="small" variant="outlined" onClick={handleCopyLink}>
          {t('event_hub.copy_link')}
        </Button>
        <Button size="small" variant="outlined" onClick={handleDownload}>
          {t('event_hub.download_image')}
        </Button>
      </Stack>
    </Box>
  );
};
