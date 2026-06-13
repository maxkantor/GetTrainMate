import React, { useMemo, useState } from 'react';
import { Box, Button, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/hooks/useI18n';
import { useWcDisplay } from '@/hooks/useWcDisplay';
import { formatI18n } from '@/i18n';
import type { EventHubSnapshot, PublicFanPick } from '@/services/sportsEventLayerService';
import { sportsEventLayerService } from '@/services/sportsEventLayerService';
import { CountryFlag } from '@/components/worldCupHub/CountryFlag';
import styles from '@/pages/WorldCupV2.module.css';

type Props = {
  eventId: string;
  hub: EventHubSnapshot;
  matchId?: string;
  isAuthenticated: boolean;
  onAuthRequired: () => void;
  compact?: boolean;
};

type FeedSort = 'recent' | 'trending';

const initials = (name?: string) =>
  (name?.trim()?.split(/\s+/).map((w) => w[0]?.toUpperCase()).join('').slice(0, 2) || 'F');

function formatPickLine(pick: PublicFanPick, t: (k: string) => string, teamName: (id: string, n?: string) => string) {
  const a = teamName(pick.teamAId ?? '', pick.teamAName);
  const b = teamName(pick.teamBId ?? '', pick.teamBName);
  if (pick.predictedScoreA != null && pick.predictedScoreB != null) {
    return `${a} ${pick.predictedScoreA}–${pick.predictedScoreB} ${b}`;
  }
  if (pick.predictionType === 'draw') return `${a} vs ${b} · ${t('event_hub.pick_draw')}`;
  const winner = pick.predictedWinnerTeamId === pick.teamAId ? a : b;
  const flag = pick.predictedWinnerTeamId === pick.teamAId ? pick.teamAFlag : pick.teamBFlag;
  return `${flag ?? ''} ${winner}`;
}

function timeAgo(iso: string, locale: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h`;
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(iso));
}

export const WcFanPickFeed: React.FC<Props> = ({
  eventId, hub, matchId, isAuthenticated, onAuthRequired, compact,
}) => {
  const { t, locale } = useI18n();
  const { teamName } = useWcDisplay();
  const queryClient = useQueryClient();
  const [sort, setSort] = useState<FeedSort>('recent');
  const [matchFilter, setMatchFilter] = useState(matchId ?? '');
  const [replyPick, setReplyPick] = useState<PublicFanPick | null>(null);
  const [replyBody, setReplyBody] = useState('');

  const enabled = hub.settings.fanFeedEnabled !== false;

  const { data: picks = [] } = useQuery({
    queryKey: ['fan-picks-feed', eventId, matchFilter || undefined, sort],
    queryFn: () => sportsEventLayerService.getFanPicksFeed(eventId, {
      matchId: matchFilter || undefined,
      sort,
      limit: compact ? 8 : 40,
    }),
    enabled,
    refetchInterval: 60_000,
  });

  const replyMutation = useMutation({
    mutationFn: (payload: { threadId: string; body: string }) =>
      sportsEventLayerService.postComment(eventId, {
        threadId: payload.threadId,
        threadType: 'match',
        body: payload.body,
      }),
    onSuccess: () => {
      setReplyBody('');
      setReplyPick(null);
      queryClient.invalidateQueries({ queryKey: ['fan-picks-feed', eventId] });
      queryClient.invalidateQueries({ queryKey: ['fan-wall', eventId] });
    },
  });

  const matchOptions = useMemo(
    () => hub.matches.filter((m) => m.teamAId && m.teamBId).slice(0, 40),
    [hub.matches],
  );

  if (!enabled) return null;

  return (
    <Box className={styles.fanPickFeed}>
      {!compact && (
        <>
          <Typography className={styles.sectionTitle}>{t('event_hub.fan_picks_feed')}</Typography>
          <Typography className={styles.sectionLead}>{t('event_hub.fan_picks_feed_lead')}</Typography>
        </>
      )}

      <Box className={styles.fanPickFilters}>
        <Button
          size="small"
          className={sort === 'recent' ? styles.subTabActive : styles.subTab}
          onClick={() => setSort('recent')}
        >
          {t('event_hub.most_recent')}
        </Button>
        <Button
          size="small"
          className={sort === 'trending' ? styles.subTabActive : styles.subTab}
          onClick={() => setSort('trending')}
        >
          {t('event_hub.trending')}
        </Button>
        {!matchId && (
          <select
            className={styles.fanPickMatchSelect}
            value={matchFilter}
            onChange={(e) => setMatchFilter(e.target.value)}
            aria-label={t('event_hub.filter_by_match')}
          >
            <option value="">{t('event_hub.all_matches')}</option>
            {matchOptions.map((m) => (
              <option key={m.matchId} value={m.matchId}>
                {teamName(m.teamAId, m.teamAName)} vs {teamName(m.teamBId, m.teamBName)}
              </option>
            ))}
          </select>
        )}
      </Box>

      {picks.length === 0 ? (
        <Box className={styles.emptyPremium}>
          <Typography className={styles.emptyTitle}>{t('event_hub.no_fan_picks')}</Typography>
        </Box>
      ) : (
        <Box className={styles.fanPickList}>
          {picks.map((pick, idx) => (
            <Box key={`${pick.matchId}-${pick.userDisplayName}-${pick.createdAt}-${idx}`} className={styles.fanPickCard}>
              <Box className={styles.fanPickHeader}>
                <Box className={styles.lbAvatarSm}>{initials(pick.userDisplayName)}</Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography className={styles.fanPickName}>
                    {formatI18n(t('event_hub.fan_pick_line'), {
                      name: pick.userDisplayName ?? t('event_hub.fan'),
                      pick: formatPickLine(pick, t, teamName),
                    })}
                  </Typography>
                  {pick.matchLabel && !matchId && (
                    <Typography className={styles.fanPickMeta}>{pick.matchLabel}</Typography>
                  )}
                </Box>
                <span className={styles.fanPickTime}>{timeAgo(pick.createdAt, locale)}</span>
              </Box>

              <Box className={styles.fanPickTeams}>
                {pick.teamAId && <CountryFlag teamId={pick.teamAId} flagEmoji={pick.teamAFlag} size={18} />}
                <span>{teamName(pick.teamAId ?? '', pick.teamAName)}</span>
                <span className={styles.todayShareVs}>{t('event_hub.vs')}</span>
                <span>{teamName(pick.teamBId ?? '', pick.teamBName)}</span>
                {pick.teamBId && <CountryFlag teamId={pick.teamBId} flagEmoji={pick.teamBFlag} size={18} />}
              </Box>

              {pick.reason && (
                <Typography className={styles.fanPickReason}>&ldquo;{pick.reason}&rdquo;</Typography>
              )}

              <Box className={styles.fanPickActions}>
                <span className={styles.fanPickStat}>↗ {pick.shareCount}</span>
                <span className={styles.fanPickStat}>💬 {pick.replyCount}</span>
                <button
                  type="button"
                  className={styles.predActionBtn}
                  onClick={() => {
                    if (!isAuthenticated) { onAuthRequired(); return; }
                    setReplyPick(pick);
                  }}
                >
                  {t('event_hub.reply')}
                </button>
              </Box>

              {replyPick === pick && (
                <Box className={styles.fanPickReplyBox}>
                  <TextField
                    fullWidth
                    size="small"
                    multiline
                    minRows={2}
                    placeholder={t('event_hub.comment_placeholder')}
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                  />
                  <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    <Button
                      size="small"
                      variant="contained"
                      className={styles.ctaPrimary}
                      disabled={!replyBody.trim() || replyMutation.isPending}
                      onClick={() => replyMutation.mutate({ threadId: pick.matchId, body: replyBody.trim() })}
                    >
                      {t('event_hub.post')}
                    </Button>
                    <Button size="small" onClick={() => setReplyPick(null)}>{t('common.cancel')}</Button>
                  </Box>
                </Box>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};
