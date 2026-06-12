import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Alert, Box, Container } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useI18n } from '@/hooks/useI18n';
import { EventHubHero } from '@/components/eventHub/EventHubHero';
import { FeaturedMatches } from '@/components/eventHub/FeaturedMatches';
import { PredictionCenter } from '@/components/eventHub/PredictionCenter';
import { TrendingOpinions } from '@/components/eventHub/TrendingOpinions';
import { TeamExplorer } from '@/components/eventHub/TeamExplorer';
import { ConnectFans } from '@/components/eventHub/ConnectFans';
import { LeaderboardsSection } from '@/components/eventHub/LeaderboardsSection';
import { StandingsPanel } from '@/components/eventHub/StandingsPanel';
import {
  sportsEventLayerService,
  WORLD_CUP_EVENT_ID,
  type CreatePredictionPayload,
  type EventPrediction,
} from '@/services/sportsEventLayerService';
import { trackSportsEventAnalytics } from '@/utils/analytics';
import { profileService } from '@/services/profileService';
import { authService } from '@/services/authService';
import styles from './EventHub.module.css';

const POLL_MS = 45_000;

export const EventHubPage: React.FC<{ eventId?: string }> = ({ eventId = WORLD_CUP_EVENT_ID }) => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthContext();
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [predictionType, setPredictionType] = useState<'winner' | 'draw' | 'exact_score'>('winner');
  const [winnerTeamId, setWinnerTeamId] = useState('');
  const [scoreA, setScoreA] = useState('1');
  const [scoreB, setScoreB] = useState('0');
  const [reason, setReason] = useState('');
  const [submittedPrediction, setSubmittedPrediction] = useState<EventPrediction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [discussionThread, setDiscussionThread] = useState('');

  const { data: hub, isLoading, isError } = useQuery({
    queryKey: ['event-hub', eventId],
    queryFn: () => sportsEventLayerService.getHubSnapshot(eventId),
    refetchInterval: POLL_MS,
    retry: 1,
  });

  const { data: liveStats } = useQuery({
    queryKey: ['event-hub-live-stats', eventId],
    queryFn: () => sportsEventLayerService.getLiveStats(eventId),
    refetchInterval: POLL_MS,
    enabled: !!hub,
  });

  React.useEffect(() => {
    if (!hub?.matches.length) return;
    if (!selectedMatchId) setSelectedMatchId(hub.matches[0].matchId);
    if (!discussionThread) setDiscussionThread(hub.matches[0].matchId);
  }, [hub, selectedMatchId, discussionThread]);

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
      queryClient.invalidateQueries({ queryKey: ['event-hub-live-stats', eventId] });
      queryClient.invalidateQueries({ queryKey: ['prediction-breakdown', eventId] });
      trackSportsEventAnalytics('event_activity_click', { eventId, activityType: 'prediction' });
    },
    onError: (e: Error) => setError(e.message),
  });

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  const handleConnect = (param: string) => {
    trackSportsEventAnalytics('event_activity_click', { eventId, activityType: param });
    if (isAuthenticated) navigate(`/app/discover?intent=${param}&event=${eventId}`);
    else navigate(`/signup?intent=${param}&event=${eventId}&return=/world-cup`);
  };

  const handlePredict = () => {
    const match = hub?.matches.find((m) => m.matchId === selectedMatchId) ?? hub?.matches[0];
    if (!match) return;
    if (!isAuthenticated) {
      navigate(`/signup?intent=world-cup&return=/world-cup#predictions`);
      return;
    }
    const payload: CreatePredictionPayload = {
      matchId: match.matchId,
      predictionType,
      reason: reason || undefined,
    };
    if (predictionType === 'winner') payload.predictedWinnerTeamId = winnerTeamId || match.teamAId;
    if (predictionType === 'exact_score') {
      payload.predictedScoreA = parseInt(scoreA, 10);
      payload.predictedScoreB = parseInt(scoreB, 10);
    }
    predictMutation.mutate(payload);
  };

  const handleFollowTeam = async (teamId: string, country: string) => {
    if (!isAuthenticated) {
      navigate(`/signup?intent=world-cup&team=${teamId}&return=/world-cup`);
      return;
    }
    const token = await authService.getJWT();
    if (!token) return;
    await profileService.updateMyProfile(token, { favoriteTeams: [country] });
    trackSportsEventAnalytics('event_profile_badge_view', { eventId, sport: country });
  };

  if (isLoading) {
    return <Box className={styles.hubRoot} sx={{ py: 12, textAlign: 'center' }}>{t('common.loading')}</Box>;
  }

  if (isError || !hub || !hub.effectivelyEnabled) {
    return <Navigate to="/" replace />;
  }

  const settings = hub.settings;
  const themeColor = hub.config.themeColor || '#6366f1';

  return (
    <Box className={styles.hubRoot} sx={{ '--wc-accent': themeColor } as React.CSSProperties}>
      <EventHubHero
        settings={settings}
        themeColor={themeColor}
        liveStats={liveStats}
        onPredict={() => scrollTo('predictions')}
        onConnect={() => handleConnect('watch')}
      />

      <Container maxWidth={false} disableGutters>
        {error && (
          <Container maxWidth="lg">
            <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>{error}</Alert>
          </Container>
        )}

        <FeaturedMatches
          matches={hub.matches}
          onPredict={(id) => { setSelectedMatchId(id); scrollTo('predictions'); }}
          onDiscuss={(id) => { setDiscussionThread(id); scrollTo('discussions'); }}
          onShare={() => scrollTo('predictions')}
        />

        <PredictionCenter
          eventId={eventId}
          matches={hub.matches}
          enabled={settings.predictionsEnabled !== false}
          exactEnabled={settings.exactScoreEnabled !== false}
          winnerEnabled={settings.winnerPickEnabled !== false}
          drawEnabled={settings.drawPickEnabled !== false}
          sharingEnabled={settings.sharingEnabled !== false}
          selectedMatchId={selectedMatchId}
          onSelectMatch={setSelectedMatchId}
          predictionType={predictionType}
          onPredictionType={setPredictionType}
          winnerTeamId={winnerTeamId}
          onWinnerTeamId={setWinnerTeamId}
          scoreA={scoreA}
          scoreB={scoreB}
          onScoreA={setScoreA}
          onScoreB={setScoreB}
          reason={reason}
          onReason={setReason}
          onSubmit={handlePredict}
          submitting={predictMutation.isPending}
          submittedPrediction={submittedPrediction}
          isAuthenticated={isAuthenticated}
          onLogin={() => navigate('/login?return=/world-cup')}
        />

        <TrendingOpinions
          eventId={eventId}
          enabled={settings.commentsEnabled !== false}
          isAuthenticated={isAuthenticated}
          defaultThreadId={discussionThread}
          onLogin={() => navigate('/login?return=/world-cup')}
        />

        <TeamExplorer
          eventId={eventId}
          onFollow={handleFollowTeam}
          onViewDiscussions={(id) => { setDiscussionThread(id); scrollTo('discussions'); }}
          onViewPredictions={() => scrollTo('predictions')}
        />

        <ConnectFans onConnect={handleConnect} />

        <LeaderboardsSection eventId={eventId} />

        <StandingsPanel
          enabled={settings.standingsEnabled === true}
          published={settings.standingsPublished === true}
          groups={hub.groups}
          teams={hub.teams}
        />
      </Container>
    </Box>
  );
};
