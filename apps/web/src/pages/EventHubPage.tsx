import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Alert, Box } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useI18n } from '@/hooks/useI18n';
import { WcHero } from '@/components/worldCupHub/WcHero';
import { WcTodaysMatches } from '@/components/worldCupHub/WcTodaysMatches';
import { WcCommunityPulse } from '@/components/worldCupHub/WcCommunityPulse';
import { WcPredictionPanel } from '@/components/worldCupHub/WcPredictionPanel';
import { WcFanOpinions } from '@/components/worldCupHub/WcFanOpinions';
import { WcTeamGrid } from '@/components/worldCupHub/WcTeamGrid';
import { WcAuthGateModal } from '@/components/worldCupHub/WcAuthGateModal';
import {
  sportsEventLayerService,
  WORLD_CUP_EVENT_ID,
  type CreatePredictionPayload,
  type EventPrediction,
} from '@/services/sportsEventLayerService';
import type { WinnerPick } from '@/types/worldCupHub';
import { trackSportsEventAnalytics } from '@/utils/analytics';
import { formatLastUpdated } from '@/utils/eventMatchUtils';
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
  const [winnerPick, setWinnerPick] = useState<WinnerPick | null>(null);
  const [showScore, setShowScore] = useState(false);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [fanTake, setFanTake] = useState('');
  const [submittedPrediction, setSubmittedPrediction] = useState<EventPrediction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opinionThread, setOpinionThread] = useState('');
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const { data: hub, isLoading, isError } = useQuery({
    queryKey: ['event-hub', eventId],
    queryFn: () => sportsEventLayerService.getHubSnapshot(eventId),
    refetchInterval: POLL_MS,
    retry: 1,
  });

  const fixtures = hub?.matches ?? [];
  const selectedFixture = fixtures.find((m) => m.matchId === selectedMatchId) ?? fixtures[0];

  React.useEffect(() => {
    if (!fixtures.length) return;
    if (!selectedMatchId) setSelectedMatchId(fixtures[0].matchId);
    if (!opinionThread) setOpinionThread(fixtures[0].matchId);
  }, [fixtures, selectedMatchId, opinionThread]);

  React.useEffect(() => {
    if (!hub || !isAuthenticated || !selectedFixture) return;
    sportsEventLayerService.getMyPrediction(eventId, selectedFixture.matchId).then((existing) => {
      if (!existing) return;
      setSubmittedPrediction(existing);
      if (existing.predictionType === 'draw') setWinnerPick('draw');
      else if (existing.predictedWinnerTeamId === selectedFixture.teamAId) setWinnerPick('teamA');
      else if (existing.predictedWinnerTeamId === selectedFixture.teamBId) setWinnerPick('teamB');
      if (existing.predictedScoreA != null) {
        setShowScore(true);
        setScoreA(String(existing.predictedScoreA));
        setScoreB(String(existing.predictedScoreB ?? ''));
      }
      if (existing.reason) setFanTake(existing.reason);
    });
  }, [hub, isAuthenticated, eventId, selectedFixture?.matchId]);

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
    mutationFn: async (payload: CreatePredictionPayload) => {
      const pred = await sportsEventLayerService.submitPrediction(eventId, payload);
      if (fanTake.trim()) {
        try {
          await sportsEventLayerService.postComment(eventId, {
            threadId: payload.matchId,
            threadType: 'match',
            body: fanTake.trim(),
          });
        } catch { /* opinion optional */ }
      }
      return pred;
    },
    onSuccess: (pred) => {
      setSubmittedPrediction(pred);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['community-pulse', eventId] });
      queryClient.invalidateQueries({ queryKey: ['prediction-breakdown', eventId] });
      queryClient.invalidateQueries({ queryKey: ['fan-opinions', eventId] });
      trackSportsEventAnalytics('event_activity_click', { eventId, activityType: 'prediction' });
    },
    onError: (e: Error) => setError(e.message),
  });

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  const requireAuth = () => setAuthModalOpen(true);

  const handleFindFans = (teamId: string) => {
    if (!isAuthenticated) { requireAuth(); return; }
    navigate(`/app/discover?intent=watch&event=${eventId}&team=${teamId}`);
  };

  const handleFindNearby = () => {
    if (!isAuthenticated) { requireAuth(); return; }
    navigate(`/app/discover?intent=watch&event=${eventId}&match=${selectedMatchId}`);
  };

  const handleSubmit = () => {
    const match = selectedFixture;
    if (!match || !winnerPick) return;
    if (!isAuthenticated) { requireAuth(); return; }

    const payload: CreatePredictionPayload = {
      matchId: match.matchId,
      predictionType: showScore && scoreA && scoreB ? 'exact_score' : winnerPick === 'draw' ? 'draw' : 'winner',
      reason: fanTake.trim() || undefined,
    };
    if (payload.predictionType === 'winner') {
      payload.predictedWinnerTeamId = winnerPick === 'teamA' ? match.teamAId : match.teamBId;
    }
    if (payload.predictionType === 'exact_score') {
      payload.predictedScoreA = parseInt(scoreA, 10);
      payload.predictedScoreB = parseInt(scoreB, 10);
      if (winnerPick === 'teamA') payload.predictedWinnerTeamId = match.teamAId;
      if (winnerPick === 'teamB') payload.predictedWinnerTeamId = match.teamBId;
    }
    predictMutation.mutate(payload);
  };

  const handleFollowTeam = async (teamId: string, country: string) => {
    const token = await authService.getJWT();
    if (!token) return;
    await profileService.updateMyProfile(token, { favoriteTeams: [country] });
    trackSportsEventAnalytics('event_profile_badge_view', { eventId, sport: country });
  };

  if (isLoading) {
    return <Box className={styles.hubRoot} sx={{ py: 8, textAlign: 'center' }}>{t('common.loading')}</Box>;
  }

  if (isError || !hub || !hub.effectivelyEnabled) {
    return <Navigate to="/" replace />;
  }

  return (
    <Box className={styles.hubRoot} sx={{ '--wc-accent': hub.config.themeColor || '#6366f1' } as React.CSSProperties}>
      <WcHero
        lastUpdated={formatLastUpdated(hub.fixturesLastUpdatedAt)}
        onPredict={() => scrollTo('predict')}
        onViewMatches={() => scrollTo('matches')}
      />

      <Box className={styles.pageBody}>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

        <WcTodaysMatches
          eventId={eventId}
          fixtures={fixtures}
          onPredict={(id) => { setSelectedMatchId(id); setSubmittedPrediction(null); scrollTo('predict'); }}
          onDiscuss={(id) => { setOpinionThread(id); scrollTo('opinions'); }}
        />

        <WcCommunityPulse eventId={eventId} />

        <WcPredictionPanel
          eventId={eventId}
          fixture={selectedFixture}
          fixtures={fixtures}
          winnerPick={winnerPick}
          onWinnerPick={setWinnerPick}
          scoreA={scoreA}
          scoreB={scoreB}
          onScoreA={setScoreA}
          onScoreB={setScoreB}
          fanTake={fanTake}
          onFanTake={setFanTake}
          showScore={showScore}
          onToggleScore={() => setShowScore((v) => !v)}
          isAuthenticated={isAuthenticated}
          submitting={predictMutation.isPending}
          submitted={submittedPrediction}
          onSubmit={handleSubmit}
          onAuthRequired={requireAuth}
          onFindFans={handleFindFans}
          onFindNearby={handleFindNearby}
        />

        <WcFanOpinions
          eventId={eventId}
          fixtures={fixtures}
          threadId={opinionThread || selectedMatchId}
          onThreadChange={setOpinionThread}
          isAuthenticated={isAuthenticated}
          onAuthRequired={requireAuth}
        />

        <WcTeamGrid
          eventId={eventId}
          isAuthenticated={isAuthenticated}
          onAuthRequired={requireAuth}
          onFollow={handleFollowTeam}
          onFindFans={handleFindFans}
        />
      </Box>

      <WcAuthGateModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </Box>
  );
};
