import React, { useMemo, useState } from 'react';
import { Link as RouterLink, Navigate, useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, Container, Grid, MenuItem, Select, Stack,
  Tab, Tabs, TextField, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useI18n } from '@/hooks/useI18n';
import { PredictionShareCard } from '@/components/eventHub/PredictionShareCard';
import {
  sportsEventLayerService,
  WORLD_CUP_EVENT_ID,
  type EventMatch,
  type EventPrediction,
  type CreatePredictionPayload,
} from '@/services/sportsEventLayerService';
import { trackSportsEventAnalytics } from '@/utils/analytics';
import { profileService } from '@/services/profileService';
import { authService } from '@/services/authService';
import styles from './EventHub.module.css';

const POLL_MS = 45_000;
const CONNECT_INTENTS = [
  { key: 'watch', emoji: '⚽', signupParam: 'watch' },
  { key: 'train', emoji: '🏋️', signupParam: 'train' },
  { key: 'socialize', emoji: '🍻', signupParam: 'vibe' },
  { key: 'date', emoji: '❤️', signupParam: 'date' },
] as const;

export const EventHubPage: React.FC<{ eventId?: string }> = ({ eventId = WORLD_CUP_EVENT_ID }) => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthContext();
  const [activeTab, setActiveTab] = useState(0);
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [predictionType, setPredictionType] = useState<'winner' | 'draw' | 'exact_score'>('winner');
  const [winnerTeamId, setWinnerTeamId] = useState('');
  const [scoreA, setScoreA] = useState('1');
  const [scoreB, setScoreB] = useState('0');
  const [reason, setReason] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [discussionThread, setDiscussionThread] = useState('');
  const [submittedPrediction, setSubmittedPrediction] = useState<EventPrediction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [favoriteTeamId, setFavoriteTeamId] = useState('');

  const { data: hub, isLoading, isError } = useQuery({
    queryKey: ['event-hub', eventId],
    queryFn: () => sportsEventLayerService.getHubSnapshot(eventId),
    refetchInterval: POLL_MS,
    retry: 1,
  });

  const { data: leaderboard } = useQuery({
    queryKey: ['event-hub-leaderboard', eventId],
    queryFn: () => sportsEventLayerService.getLeaderboard(eventId, 'predictors'),
    refetchInterval: POLL_MS,
    enabled: !!hub,
  });

  const { data: activeFans } = useQuery({
    queryKey: ['event-hub-active', eventId],
    queryFn: () => sportsEventLayerService.getLeaderboard(eventId, 'active'),
    refetchInterval: POLL_MS,
    enabled: !!hub,
  });

  const { data: sharedLb } = useQuery({
    queryKey: ['event-hub-shared', eventId],
    queryFn: () => sportsEventLayerService.getLeaderboard(eventId, 'shared'),
    refetchInterval: POLL_MS,
    enabled: !!hub,
  });

  const { data: comments, refetch: refetchComments } = useQuery({
    queryKey: ['event-hub-comments', eventId, discussionThread],
    queryFn: () => sportsEventLayerService.getComments(eventId, discussionThread),
    enabled: !!discussionThread && !!hub,
  });

  const settings = hub?.settings;
  const themeColor = hub?.config.themeColor || '#6366f1';
  const matches = hub?.matches ?? [];
  const teams = hub?.teams ?? [];
  const groups = hub?.groups ?? [];

  const selectedMatch = useMemo(
    () => matches.find((m) => m.matchId === selectedMatchId) ?? matches[0],
    [matches, selectedMatchId]
  );

  React.useEffect(() => {
    if (matches.length && !selectedMatchId) setSelectedMatchId(matches[0].matchId);
    if (matches.length && !discussionThread) setDiscussionThread(matches[0].matchId);
  }, [matches, selectedMatchId, discussionThread]);

  React.useEffect(() => {
    if (!hub) return;
    trackSportsEventAnalytics('event_page_view', {
      eventId: hub.config.eventId,
      eventLabel: hub.config.label,
      sport: hub.config.sport,
      sourcePage: '/world-cup',
    });
  }, [hub]);

  const predictMutation = useMutation({
    mutationFn: (payload: CreatePredictionPayload) =>
      sportsEventLayerService.submitPrediction(eventId, payload),
    onSuccess: (pred) => {
      setSubmittedPrediction(pred);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['event-hub-leaderboard', eventId] });
      trackSportsEventAnalytics('event_activity_click', { eventId, activityType: 'prediction' });
    },
    onError: (e: Error) => setError(e.message),
  });

  const commentMutation = useMutation({
    mutationFn: () =>
      sportsEventLayerService.postComment(eventId, {
        threadId: discussionThread,
        threadType: 'match',
        body: commentBody,
      }),
    onSuccess: () => {
      setCommentBody('');
      refetchComments();
    },
    onError: (e: Error) => setError(e.message),
  });

  const handlePredict = () => {
    if (!selectedMatch) return;
    if (!isAuthenticated) {
      navigate(`/signup?intent=world-cup&return=/world-cup`);
      return;
    }
    const payload: CreatePredictionPayload = {
      matchId: selectedMatch.matchId,
      predictionType,
      reason: reason || undefined,
    };
    if (predictionType === 'winner') payload.predictedWinnerTeamId = winnerTeamId || selectedMatch.teamAId;
    if (predictionType === 'exact_score') {
      payload.predictedScoreA = parseInt(scoreA, 10);
      payload.predictedScoreB = parseInt(scoreB, 10);
    }
    predictMutation.mutate(payload);
  };

  const handleConnect = (signupParam: string) => {
    trackSportsEventAnalytics('event_activity_click', { eventId, activityType: signupParam });
    if (isAuthenticated) {
      navigate(`/app/discover?intent=${signupParam}&event=${eventId}`);
    } else {
      navigate(`/signup?intent=${signupParam}&event=${eventId}&return=/world-cup`);
    }
  };

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 8, textAlign: 'center' }}>
        <Typography>{t('common.loading')}</Typography>
      </Container>
    );
  }

  if (isError || !hub || !hub.effectivelyEnabled) {
    return <Navigate to="/" replace />;
  }

  const matchesByDate = matches.reduce<Record<string, EventMatch[]>>((acc, m) => {
    (acc[m.matchDate] ??= []).push(m);
    return acc;
  }, {});

  return (
    <Box className={styles.hubRoot}>
      {/* 1. Hero */}
      <Box
        className={styles.hero}
        sx={{
          background: `linear-gradient(135deg, rgba(7,11,26,0.95), rgba(26,16,64,0.85)), url('/images/section-worldcup-bg.png') center/cover`,
          borderBottom: `1px solid ${themeColor}44`,
        }}
      >
        <Container maxWidth="lg" sx={{ py: { xs: 5, md: 8 } }}>
          <Chip label="⚽ World Cup 2026" sx={{ mb: 2, bgcolor: `${themeColor}33`, color: '#fff' }} />
          <Typography variant="h2" component="h1" className={styles.heroTitle}>
            {settings?.homepageHeadline ?? t('event_hub.hero_title')}
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 640, mb: 3 }}>
            {settings?.homepageSubheadline ?? t('event_hub.hero_subtitle')}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <Button
              variant="contained"
              size="large"
              onClick={() => document.getElementById('predictions')?.scrollIntoView({ behavior: 'smooth' })}
            >
              {settings?.homepageCtaPrimary ?? t('event_hub.cta_predict')}
            </Button>
            <Button variant="outlined" size="large" onClick={() => handleConnect('watch')}>
              {settings?.homepageCtaSecondary ?? t('event_hub.cta_connect')}
            </Button>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {settings?.homepagePromoText ?? t('event_hub.promo_text')}
          </Typography>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

        {/* 2. Group Standings */}
        <Box component="section" sx={{ mb: 6 }}>
          <Typography variant="h4" gutterBottom>{t('event_hub.standings_title')}</Typography>
          <Grid container spacing={2}>
            {groups.map((g) => (
              <Grid item xs={12} sm={6} md={4} key={g.groupId}>
                <Box className={styles.glassCard}>
                  <Typography variant="h6" sx={{ mb: 1, color: themeColor }}>{g.label}</Typography>
                  <Box className={styles.standingsTable}>
                    <Box className={styles.standingsHeader}>
                      <span>{t('event_hub.team')}</span><span>P</span><span>W</span><span>D</span><span>L</span><span>GD</span><span>Pts</span>
                    </Box>
                    {teams.filter((t) => t.groupId === g.groupId).map((team) => (
                      <Box key={team.teamId} className={styles.standingsRow}>
                        <span>{team.flagEmoji} {team.name}</span>
                        <span>{team.played}</span><span>{team.wins}</span><span>{team.draws}</span>
                        <span>{team.losses}</span><span>{team.goalDifference}</span><span>{team.points}</span>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* 3. Match Center */}
        <Box component="section" sx={{ mb: 6 }}>
          <Typography variant="h4" gutterBottom>{t('event_hub.matches_title')}</Typography>
          {Object.entries(matchesByDate).map(([date, dayMatches]) => (
            <Box key={date} sx={{ mb: 3 }}>
              <Typography variant="subtitle1" color="primary.light" sx={{ mb: 1 }}>{date}</Typography>
              <Grid container spacing={2}>
                {dayMatches.map((m) => (
                  <Grid item xs={12} sm={6} md={4} key={m.matchId}>
                    <Box
                      className={styles.glassCard}
                      onClick={() => { setSelectedMatchId(m.matchId); setDiscussionThread(m.matchId); }}
                      sx={{ cursor: 'pointer', borderColor: selectedMatchId === m.matchId ? themeColor : undefined }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                        <Typography variant="caption" color="text.secondary">{m.venue}</Typography>
                        {m.status === 'Live' && <Chip label="LIVE" size="small" color="error" />}
                        {m.status === 'Completed' && <Chip label={t('event_hub.completed')} size="small" />}
                      </Stack>
                      <Typography variant="body1" fontWeight={600}>
                        {m.teamAFlag} {m.teamAName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ my: 0.5 }}>
                        {m.status === 'Completed' && m.scoreA != null ? `${m.scoreA} - ${m.scoreB}` : 'vs'}
                      </Typography>
                      <Typography variant="body1" fontWeight={600}>
                        {m.teamBFlag} {m.teamBName}
                      </Typography>
                      {m.matchTime && <Typography variant="caption" color="text.secondary">{m.matchTime}</Typography>}
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>
          ))}
        </Box>

        {/* 4. Prediction Center */}
        {settings?.predictionsEnabled !== false && (
          <Box id="predictions" component="section" sx={{ mb: 6 }}>
            <Typography variant="h4" gutterBottom>{t('event_hub.predictions_title')}</Typography>
            <Box className={styles.glassCard}>
              {selectedMatch && (
                <>
                  <Typography variant="subtitle1" sx={{ mb: 2 }}>
                    {selectedMatch.teamAFlag} {selectedMatch.teamAName} vs {selectedMatch.teamBName} {selectedMatch.teamBFlag}
                  </Typography>
                  <Select
                    fullWidth size="small" value={predictionType}
                    onChange={(e) => setPredictionType(e.target.value as typeof predictionType)}
                    sx={{ mb: 2 }}
                  >
                    {settings?.winnerPickEnabled !== false && <MenuItem value="winner">{t('event_hub.pick_winner')}</MenuItem>}
                    {settings?.drawPickEnabled !== false && <MenuItem value="draw">{t('event_hub.pick_draw')}</MenuItem>}
                    {settings?.exactScoreEnabled !== false && <MenuItem value="exact_score">{t('event_hub.pick_score')}</MenuItem>}
                  </Select>
                  {predictionType === 'winner' && (
                    <Select fullWidth size="small" value={winnerTeamId} onChange={(e) => setWinnerTeamId(e.target.value)} sx={{ mb: 2 }}>
                      <MenuItem value={selectedMatch.teamAId}>{selectedMatch.teamAName}</MenuItem>
                      <MenuItem value={selectedMatch.teamBId}>{selectedMatch.teamBName}</MenuItem>
                    </Select>
                  )}
                  {predictionType === 'exact_score' && (
                    <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                      <TextField size="small" label={selectedMatch.teamAName} value={scoreA} onChange={(e) => setScoreA(e.target.value)} type="number" />
                      <TextField size="small" label={selectedMatch.teamBName} value={scoreB} onChange={(e) => setScoreB(e.target.value)} type="number" />
                    </Stack>
                  )}
                  <TextField
                    fullWidth size="small" multiline rows={2}
                    label={t('event_hub.why_optional')}
                    value={reason} onChange={(e) => setReason(e.target.value)} sx={{ mb: 2 }}
                  />
                  <Button variant="contained" onClick={handlePredict} disabled={predictMutation.isPending}>
                    {t('event_hub.submit_prediction')}
                  </Button>
                  {submittedPrediction && settings?.sharingEnabled !== false && (
                    <PredictionShareCard
                      match={selectedMatch}
                      prediction={submittedPrediction}
                      onShared={() => sportsEventLayerService.sharePrediction(eventId, selectedMatch.matchId)}
                    />
                  )}
                </>
              )}
            </Box>
          </Box>
        )}

        {/* 5. Fan Discussions */}
        {settings?.commentsEnabled !== false && (
          <Box component="section" sx={{ mb: 6 }}>
            <Typography variant="h4" gutterBottom>{t('event_hub.discussions_title')}</Typography>
            <Select fullWidth size="small" value={discussionThread} onChange={(e) => setDiscussionThread(e.target.value)} sx={{ mb: 2 }}>
              {matches.map((m) => (
                <MenuItem key={m.matchId} value={m.matchId}>{m.teamAName} vs {m.teamBName}</MenuItem>
              ))}
              {teams.map((team) => (
                <MenuItem key={team.teamId} value={team.teamId}>{team.flagEmoji} {team.name}</MenuItem>
              ))}
            </Select>
            <Box className={styles.glassCard}>
              {(comments ?? []).map((c) => (
                <Box key={c.commentKey} sx={{ mb: 1.5, pb: 1.5, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <Typography variant="caption" color="primary.light">{c.userDisplayName ?? t('event_hub.fan')}</Typography>
                  <Typography variant="body2">{c.body}</Typography>
                </Box>
              ))}
              {isAuthenticated ? (
                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                  <TextField fullWidth size="small" value={commentBody} onChange={(e) => setCommentBody(e.target.value)} placeholder={t('event_hub.comment_placeholder')} />
                  <Button variant="contained" onClick={() => commentMutation.mutate()} disabled={!commentBody.trim()}>{t('event_hub.post')}</Button>
                </Stack>
              ) : (
                <Button component={RouterLink} to="/login?return=/world-cup" sx={{ mt: 2 }}>{t('event_hub.login_to_comment')}</Button>
              )}
            </Box>
          </Box>
        )}

        {/* 6. Leaderboards */}
        <Box component="section" sx={{ mb: 6 }}>
          <Typography variant="h4" gutterBottom>{t('event_hub.leaderboard_title')}</Typography>
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2 }}>
            <Tab label={t('event_hub.lb_predictors')} />
            <Tab label={t('event_hub.lb_active')} />
            <Tab label={t('event_hub.lb_shared')} />
          </Tabs>
          <Box className={styles.glassCard}>
            {(activeTab === 0 ? leaderboard : activeTab === 1 ? activeFans : sharedLb)?.map((entry, i) => (
              <Box key={entry.userId} className={styles.lbRow}>
                <span>#{i + 1}</span>
                <span>{entry.displayName ?? t('event_hub.fan')}</span>
                <span>{activeTab === 0 ? entry.score : activeTab === 1 ? entry.commentCount + entry.predictionsCount : entry.shareCount}</span>
              </Box>
            )) ?? <Typography color="text.secondary">{t('event_hub.no_leaderboard')}</Typography>}
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>{t('event_hub.lb_disclaimer')}</Typography>
          </Box>
        </Box>

        {/* Favorite Team Badge */}
        <Box component="section" sx={{ mb: 6 }}>
          <Typography variant="h4" gutterBottom>{t('event_hub.favorite_team_title')}</Typography>
          <Box className={styles.glassCard}>
            <Select fullWidth size="small" displayEmpty value={favoriteTeamId} onChange={(e) => setFavoriteTeamId(e.target.value)} sx={{ mb: 2 }}>
              <MenuItem value="">{t('event_hub.select_team')}</MenuItem>
              {teams.map((team) => (
                <MenuItem key={team.teamId} value={team.teamId}>{team.flagEmoji} {team.name}</MenuItem>
              ))}
            </Select>
            {favoriteTeamId && (
              <Chip
                label={`${teams.find((t) => t.teamId === favoriteTeamId)?.flagEmoji ?? ''} ${teams.find((t) => t.teamId === favoriteTeamId)?.name ?? ''} Fan`}
                color="primary"
                sx={{ mr: 1 }}
              />
            )}
            {isAuthenticated && favoriteTeamId && (
              <Button
                size="small"
                variant="outlined"
                onClick={async () => {
                  const token = await authService.getJWT();
                  if (!token) return;
                  const team = teams.find((t) => t.teamId === favoriteTeamId);
                  if (!team) return;
                  await profileService.updateMyProfile(token, { favoriteTeams: [team.country] });
                  trackSportsEventAnalytics('event_profile_badge_view', { eventId, sport: team.country });
                }}
              >
                {t('event_hub.save_favorite')}
              </Button>
            )}
          </Box>
        </Box>

        {/* 7. Connect With Fans */}
        <Box component="section" sx={{ mb: 6 }}>
          <Typography variant="h4" gutterBottom>{t('event_hub.connect_title')}</Typography>
          <Grid container spacing={2}>
            {CONNECT_INTENTS.map((intent) => (
              <Grid item xs={6} sm={3} key={intent.key}>
                <Button
                  fullWidth variant="outlined" className={styles.connectBtn}
                  onClick={() => handleConnect(intent.signupParam)}
                >
                  <span>{intent.emoji}</span>
                  <span>{t(`event_hub.connect_${intent.key}`)}</span>
                </Button>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* 8. Share Predictions CTA */}
        <Box component="section" sx={{ mb: 4, textAlign: 'center' }}>
          <Typography variant="h5" gutterBottom>{t('event_hub.share_section_title')}</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>{t('event_hub.share_section_desc')}</Typography>
          <Button variant="contained" onClick={() => document.getElementById('predictions')?.scrollIntoView({ behavior: 'smooth' })}>
            {t('event_hub.cta_predict')}
          </Button>
        </Box>
      </Container>
    </Box>
  );
};
