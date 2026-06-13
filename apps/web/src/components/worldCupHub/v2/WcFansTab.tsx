import React, { useState } from 'react';
import { Alert, Box, Button, Snackbar, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MatchFlagPair } from '@/components/worldCupHub/MatchFlagPair';
import { TeamExploreCard } from '@/components/worldCupHub/TeamExploreCard';
import { useI18n } from '@/hooks/useI18n';
import { useWcDisplay } from '@/hooks/useWcDisplay';
import { sportsEventLayerService } from '@/services/sportsEventLayerService';
import { WcFanPickFeed } from './WcFanPickFeed';
import type { WcHubProps } from './wcTypes';
import styles from '@/pages/WorldCupV2.module.css';

type Props = Pick<WcHubProps, 'eventId' | 'hub' | 'isAuthenticated' | 'onAuthRequired' | 'onFindFans' | 'onTabChange'>;

const initials = (name?: string) => (name?.trim()?.[0] ?? 'F').toUpperCase();

export const WcFansTab: React.FC<Props> = ({
  eventId, hub, isAuthenticated, onAuthRequired, onFindFans, onTabChange,
}) => {
  const { t } = useI18n();
  const { teamName } = useWcDisplay();
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [reported, setReported] = useState<Set<string>>(new Set());

  const { data: opinions = [] } = useQuery({
    queryKey: ['fan-wall', eventId],
    queryFn: () => sportsEventLayerService.getTrendingComments(eventId, 'recent'),
    refetchInterval: 45_000,
  });

  const { data: teamStats = [] } = useQuery({
    queryKey: ['team-stats', eventId],
    queryFn: () => sportsEventLayerService.getTeamStats(eventId),
    staleTime: 60_000,
  });

  const postMutation = useMutation({
    mutationFn: (payload: { body: string; threadId: string; parent?: string }) =>
      sportsEventLayerService.postComment(eventId, {
        threadId: payload.threadId,
        threadType: 'match',
        body: payload.body,
        parentCommentKey: payload.parent,
      }),
    onSuccess: () => {
      setBody('');
      setReplyBody('');
      setReplyTo(null);
      queryClient.invalidateQueries({ queryKey: ['fan-wall', eventId] });
    },
  });

  const likeMutation = useMutation({
    mutationFn: (key: string) => sportsEventLayerService.likeComment(eventId, key),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fan-wall', eventId] }),
  });

  const defaultThread = hub.matches[0]?.matchId ?? 'general';
  const topLevel = opinions.filter((o) => !o.parentCommentKey).slice(0, 30);
  const repliesFor = (key: string) => opinions.filter((o) => o.parentCommentKey === key);

  const inviteLink = `${window.location.origin}/world-cup?invite=friend`;

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setToast(t('event_hub.link_copied'));
    } catch {
      setToast(t('event_hub.copy_failed'));
    }
  };

  const handleReport = (key: string) => {
    setReported((s) => new Set(s).add(key));
    setToast(t('event_hub.reported'));
  };

  return (
    <Box className={styles.tabPanel}>
      {hub.settings.fanFeedEnabled !== false && (
        <WcFanPickFeed
          eventId={eventId}
          hub={hub}
          isAuthenticated={isAuthenticated}
          onAuthRequired={onAuthRequired}
        />
      )}

      {hub.settings.commentsEnabled !== false && (
        <>
      <Typography className={styles.sectionTitle}>{t('event_hub.fan_wall_title')}</Typography>
      <Typography className={styles.sectionLead}>{t('event_hub.fan_wall_lead')}</Typography>

      <Box className={styles.challengeGrid}>
        <button type="button" className={styles.challengeCard} onClick={copyInvite}>
          <div className={styles.challengeIcon}>🤝</div>
          <div className={styles.challengeTitle}>{t('event_hub.challenge_invite')}</div>
          <div className={styles.challengeDesc}>{t('event_hub.challenge_invite_desc')}</div>
        </button>
        <button type="button" className={styles.challengeCard} onClick={() => onTabChange('leaderboard')}>
          <div className={styles.challengeIcon}>⚔️</div>
          <div className={styles.challengeTitle}>{t('event_hub.challenge_compare')}</div>
          <div className={styles.challengeDesc}>{t('event_hub.challenge_compare_desc')}</div>
        </button>
        <button type="button" className={styles.challengeCard} onClick={() => onTabChange('my-picks')}>
          <div className={styles.challengeIcon}>🏆</div>
          <div className={styles.challengeTitle}>{t('event_hub.challenge_battle')}</div>
          <div className={styles.challengeDesc}>{t('event_hub.challenge_battle_desc')}</div>
        </button>
      </Box>

      {isAuthenticated ? (
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            multiline
            rows={2}
            placeholder={t('event_hub.fan_wall_placeholder')}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            sx={{ '& .MuiInputBase-root': { bgcolor: 'rgba(0,0,0,0.3)', color: '#fff', borderRadius: 2 } }}
          />
          <Button
            variant="contained"
            className={styles.ctaPrimary}
            sx={{ mt: 1 }}
            disabled={!body.trim() || postMutation.isPending}
            onClick={() => postMutation.mutate({ body: body.trim(), threadId: defaultThread })}
          >
            {t('event_hub.post')}
          </Button>
        </Box>
      ) : (
        <Button variant="outlined" className={styles.ctaSecondary} sx={{ mb: 2 }} onClick={onAuthRequired}>
          {t('event_hub.login_to_comment')}
        </Button>
      )}

      {topLevel.length === 0 ? (
        <Box className={styles.emptyPremium}>
          <Typography className={styles.emptyTitle}>{t('event_hub.opinions_empty')}</Typography>
        </Box>
      ) : (
        <Box className={styles.fanWall}>
          {topLevel.map((o) => {
            const match = hub.matches.find((m) => m.matchId === o.threadId);
            const replies = repliesFor(o.commentKey);
            return (
              <Box key={o.commentKey} className={styles.fanPost}>
                <Box className={styles.fanAvatar}>{initials(o.userDisplayName)}</Box>
                <Box>
                  <Box className={styles.fanPostHeader}>
                    <span className={styles.fanName}>{o.userDisplayName ?? t('event_hub.fan')}</span>
                    {match && (
                      <span className={styles.fanMeta}>
                        <MatchFlagPair match={match} size={18} />
                      </span>
                    )}
                    <span className={styles.fanMeta}>{new Date(o.createdAt).toLocaleString()}</span>
                  </Box>
                  <Typography className={styles.fanBody}>{o.body}</Typography>
                  <Box className={styles.fanActions}>
                    <Button
                      className={styles.fanActionBtn}
                      disabled={!isAuthenticated || likeMutation.isPending}
                      onClick={() => {
                        if (!isAuthenticated) { onAuthRequired(); return; }
                        likeMutation.mutate(o.commentKey);
                      }}
                    >
                      ♥ {o.likeCount}
                    </Button>
                    <Button className={styles.fanActionBtn} onClick={() => setReplyTo(replyTo === o.commentKey ? null : o.commentKey)}>
                      {t('event_hub.reply')}
                    </Button>
                    {!reported.has(o.commentKey) && (
                      <Button className={styles.fanActionBtn} onClick={() => handleReport(o.commentKey)}>
                        {t('event_hub.report')}
                      </Button>
                    )}
                  </Box>
                  {replyTo === o.commentKey && isAuthenticated && (
                    <Box className={styles.replyBox}>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder={t('event_hub.reply_placeholder')}
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        sx={{ '& .MuiInputBase-root': { bgcolor: 'rgba(0,0,0,0.25)', color: '#fff' } }}
                      />
                      <Button
                        size="small"
                        sx={{ mt: 0.5 }}
                        disabled={!replyBody.trim()}
                        onClick={() => postMutation.mutate({ body: replyBody.trim(), threadId: o.threadId, parent: o.commentKey })}
                      >
                        {t('event_hub.post')}
                      </Button>
                    </Box>
                  )}
                  {replies.map((r) => (
                    <Box key={r.commentKey} className={styles.replyBox}>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.82rem' }}>{r.userDisplayName ?? t('event_hub.fan')}</Typography>
                      <Typography className={styles.fanBody}>{r.body}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      <Typography className={styles.sectionTitle} sx={{ mt: 3 }}>{t('event_hub.find_fans_title')}</Typography>
      <Typography className={styles.sectionLead}>{t('event_hub.find_fans_lead')}</Typography>

      {teamStats.length === 0 ? (
        <Box className={styles.emptyPremium}>
          <Typography className={styles.emptyDesc}>{t('event_hub.teams_coming_soon')}</Typography>
        </Box>
      ) : (
        <Box className={styles.teamExploreGrid}>
          {teamStats.map((team) => (
            <TeamExploreCard
              key={team.teamId}
              teamId={team.teamId}
              name={teamName(team.teamId, team.name)}
              flagEmoji={team.flagEmoji}
              subtitle={`${team.fanCount} ${t('event_hub.fans')}`}
              as="div"
              footer={(
                <Button
                  fullWidth
                  size="small"
                  variant="contained"
                  className={styles.ctaPrimary}
                  sx={{ fontSize: '0.72rem' }}
                  onClick={() => {
                    if (!isAuthenticated) { onAuthRequired(); return; }
                    onFindFans(team.teamId);
                  }}
                >
                  {t('event_hub.connect')}
                </Button>
              )}
            />
          ))}
        </Box>
      )}

        </>
      )}

      <Snackbar open={Boolean(toast)} autoHideDuration={3000} onClose={() => setToast(null)}>
        <Alert severity="success" onClose={() => setToast(null)}>{toast}</Alert>
      </Snackbar>
    </Box>
  );
};
