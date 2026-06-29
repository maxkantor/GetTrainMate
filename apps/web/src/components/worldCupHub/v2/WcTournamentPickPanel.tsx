import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatI18n } from '@/i18n';
import { useI18n } from '@/hooks/useI18n';
import { WcTeamLabel } from '@/components/worldCupHub/WcTeamLabel';
import {
  sportsEventLayerService,
  type EventHubSnapshot,
} from '@/services/sportsEventLayerService';
import { getBracketEligibleTeams } from '@/utils/eventMatchUtils';
import {
  canAllReachSemifinals,
  findCollisionPartner,
  hasGroupWinnerPathCollision,
  wouldBreakSemifinalPaths,
} from '@/utils/tournamentBracketPathRules';
import { WcTournamentPickShare } from './WcTournamentPickShare';
import styles from '@/pages/WorldCupV2.module.css';

const SEMIFINAL_COUNT = 4;

type Props = {
  eventId: string;
  hub: EventHubSnapshot;
  isAuthenticated: boolean;
  onAuthRequired: () => void;
};

const sameTeam = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export const WcTournamentPickPanel: React.FC<Props> = ({
  eventId, hub, isAuthenticated, onAuthRequired,
}) => {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const eligibleTeams = useMemo(
    () => getBracketEligibleTeams(hub.teams, hub.matches),
    [hub.teams, hub.matches],
  );

  const { data: savedPick } = useQuery({
    queryKey: ['tournament-pick', eventId],
    queryFn: () => sportsEventLayerService.getMyTournamentPick(eventId),
    enabled: isAuthenticated,
  });

  const [semifinals, setSemifinals] = useState<string[]>([]);
  const [champion, setChampion] = useState<string | null>(null);
  const [thirdPlace, setThirdPlace] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!savedPick) return;
    setSemifinals(savedPick.semifinalTeamIds ?? []);
    setChampion(savedPick.championTeamId ?? null);
    setThirdPlace(savedPick.thirdPlaceTeamId ?? null);
    setSaved(
      (savedPick.semifinalTeamIds?.length ?? 0) === SEMIFINAL_COUNT
      && Boolean(savedPick.championTeamId)
      && Boolean(savedPick.thirdPlaceTeamId),
    );
  }, [savedPick]);

  const picksOpen = savedPick?.picksOpen !== false;
  const locked = !picksOpen || savedPick?.locked === true;
  const editing = !locked && !saved;

  const semifinalSet = useMemo(
    () => new Set(semifinals.map((id) => id.trim().toLowerCase())),
    [semifinals],
  );

  const toggleSemifinal = (teamId: string) => {
    if (locked) return;
    if (!isAuthenticated) {
      onAuthRequired();
      return;
    }
    setSaveError(null);
    setSaved(false);
    setSemifinals((prev) => {
      if (prev.some((id) => sameTeam(id, teamId))) {
        const next = prev.filter((id) => !sameTeam(id, teamId));
        if (champion && !next.some((id) => sameTeam(id, champion))) setChampion(null);
        if (thirdPlace && !next.some((id) => sameTeam(id, thirdPlace))) setThirdPlace(null);
        return next;
      }
      if (prev.length >= SEMIFINAL_COUNT) return prev;
      if (wouldBreakSemifinalPaths(prev, teamId)) {
        const partnerId = findCollisionPartner(prev, teamId);
        const partner = partnerId
          ? eligibleTeams.find((t) => sameTeam(t.teamId, partnerId))
          : null;
        const team = eligibleTeams.find((t) => sameTeam(t.teamId, teamId));
        setSaveError(
          partner && team
            ? formatI18n(t('event_hub.tournament_pick_path_conflict_pair'), {
                teamA: team.name,
                teamB: partner.name,
              })
            : t('event_hub.tournament_pick_path_conflict'),
        );
        return prev;
      }
      return [...prev, teamId];
    });
  };

  const pickChampion = (teamId: string) => {
    if (locked || !semifinalSet.has(teamId.trim().toLowerCase())) return;
    if (!isAuthenticated) {
      onAuthRequired();
      return;
    }
    setSaveError(null);
    setSaved(false);
    setChampion(teamId);
    if (thirdPlace && sameTeam(thirdPlace, teamId)) setThirdPlace(null);
  };

  const pickThird = (teamId: string) => {
    if (locked || !semifinalSet.has(teamId.trim().toLowerCase())) return;
    if (champion && sameTeam(champion, teamId)) return;
    if (!isAuthenticated) {
      onAuthRequired();
      return;
    }
    setSaveError(null);
    setSaved(false);
    setThirdPlace(teamId);
  };

  const canSave = semifinals.length === SEMIFINAL_COUNT
    && champion
    && thirdPlace
    && picksOpen
    && canAllReachSemifinals(semifinals);

  const saveMutation = useMutation({
    mutationFn: () => sportsEventLayerService.saveTournamentPick(eventId, {
      semifinalTeamIds: semifinals,
      championTeamId: champion!,
      thirdPlaceTeamId: thirdPlace!,
    }),
    onSuccess: () => {
      setSaved(true);
      setSaveError(null);
      queryClient.invalidateQueries({ queryKey: ['tournament-pick', eventId] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setSaveError(msg ?? t('event_hub.tournament_pick_save_failed'));
    },
  });

  const selectedSemifinalTeams = eligibleTeams.filter((team) =>
    semifinals.some((id) => sameTeam(id, team.teamId)));

  const persistedSemifinalIds = savedPick?.semifinalTeamIds?.length === SEMIFINAL_COUNT
    ? savedPick.semifinalTeamIds
    : (saved && semifinals.length === SEMIFINAL_COUNT ? semifinals : []);
  const persistedChampionId = savedPick?.championTeamId ?? (saved ? champion : null);
  const persistedThirdId = savedPick?.thirdPlaceTeamId ?? (saved ? thirdPlace : null);

  const shareReady = persistedSemifinalIds.length === SEMIFINAL_COUNT
    && Boolean(persistedChampionId)
    && Boolean(persistedThirdId);

  const shareSemifinalists = hub.teams.filter((team) =>
    persistedSemifinalIds.some((id) => sameTeam(id, team.teamId)));
  const shareChampion = hub.teams.find((team) => persistedChampionId && sameTeam(team.teamId, persistedChampionId));
  const shareThird = hub.teams.find((team) => persistedThirdId && sameTeam(team.teamId, persistedThirdId));

  if (eligibleTeams.length === 0) return null;

  return (
    <Box className={styles.tournamentPickPanel}>
      <Typography className={styles.tournamentPickTitle}>
        {t('event_hub.tournament_pick_title')}
      </Typography>
      <Typography className={styles.tournamentPickLead}>
        {t('event_hub.tournament_pick_lead')}
      </Typography>

      {locked && (
        <Typography className={styles.tournamentPickLocked}>
          {t('event_hub.tournament_pick_locked')}
        </Typography>
      )}

      <Box className={styles.tournamentPickStep}>
        <Typography className={styles.tournamentPickStepTitle}>
          {t('event_hub.tournament_pick_semifinals')}
          {' '}
          <span className={styles.tournamentPickCounter}>
            ({semifinals.length}/{SEMIFINAL_COUNT})
          </span>
        </Typography>
        <Box className={styles.tournamentPickGrid} role="list">
          {eligibleTeams.map((team) => {
            const selected = semifinals.some((id) => sameTeam(id, team.teamId));
            const pathBlocked = !selected
              && semifinals.length < SEMIFINAL_COUNT
              && semifinals.some((id) => hasGroupWinnerPathCollision(id, team.teamId));
            const disabled = locked
              || (!selected && semifinals.length >= SEMIFINAL_COUNT)
              || pathBlocked;
            return (
              <button
                key={team.teamId}
                type="button"
                role="listitem"
                className={`${styles.tournamentPickChip} ${selected ? styles.tournamentPickChipActive : ''} ${pathBlocked ? styles.tournamentPickChipBlocked : ''}`}
                disabled={disabled}
                onClick={() => toggleSemifinal(team.teamId)}
                aria-pressed={selected}
                title={pathBlocked ? t('event_hub.tournament_pick_path_blocked_hint') : undefined}
              >
                <WcTeamLabel teamId={team.teamId} fallbackName={team.name} flagEmoji={team.flagEmoji} size={20} />
              </button>
            );
          })}
        </Box>
      </Box>

      {semifinals.length === SEMIFINAL_COUNT && (
        <>
          <Box className={styles.tournamentPickStep}>
            <Typography className={styles.tournamentPickStepTitle}>
              {t('event_hub.tournament_pick_champion')}
            </Typography>
            <Box className={styles.tournamentPickFinalRow}>
              {selectedSemifinalTeams.map((team) => {
                const active = champion != null && sameTeam(champion, team.teamId);
                return (
                  <button
                    key={`champion-${team.teamId}`}
                    type="button"
                    className={`${styles.tournamentPickFinalBtn} ${active ? styles.tournamentPickFinalBtnActive : ''}`}
                    disabled={locked}
                    onClick={() => pickChampion(team.teamId)}
                    aria-pressed={active}
                  >
                    <WcTeamLabel teamId={team.teamId} fallbackName={team.name} flagEmoji={team.flagEmoji} />
                  </button>
                );
              })}
            </Box>
          </Box>

          <Box className={styles.tournamentPickStep}>
            <Typography className={styles.tournamentPickStepTitle}>
              {t('event_hub.tournament_pick_third')}
            </Typography>
            <Box className={styles.tournamentPickFinalRow}>
              {selectedSemifinalTeams
                .filter((team) => !champion || !sameTeam(champion, team.teamId))
                .map((team) => {
                  const active = thirdPlace != null && sameTeam(thirdPlace, team.teamId);
                  return (
                    <button
                      key={`third-${team.teamId}`}
                      type="button"
                      className={`${styles.tournamentPickFinalBtn} ${active ? styles.tournamentPickFinalBtnBronze : ''}`}
                      disabled={locked || !champion}
                      onClick={() => pickThird(team.teamId)}
                      aria-pressed={active}
                    >
                      <WcTeamLabel teamId={team.teamId} fallbackName={team.name} flagEmoji={team.flagEmoji} />
                    </button>
                  );
                })}
            </Box>
          </Box>
        </>
      )}

      {saveError && (
        <Typography className={styles.tournamentPickError} role="alert">
          {saveError}
        </Typography>
      )}

      {saved && !editing && (
        <Typography className={styles.tournamentPickSaved}>
          {t('event_hub.tournament_pick_saved')}
        </Typography>
      )}

      {!locked && canSave && (editing || !saved) && (
        <Button
          type="button"
          variant="contained"
          className={styles.tournamentPickSaveBtn}
          disabled={saveMutation.isPending}
          onClick={() => {
            if (!isAuthenticated) {
              onAuthRequired();
              return;
            }
            saveMutation.mutate();
          }}
        >
          {saveMutation.isPending ? t('event_hub.saving') : t('event_hub.tournament_pick_save')}
        </Button>
      )}

      {!locked && saved && (
        <Button
          type="button"
          variant="outlined"
          className={styles.tournamentPickEditBtn}
          onClick={() => setSaved(false)}
        >
          {t('event_hub.edit_pick')}
        </Button>
      )}

      {shareReady && shareChampion && shareThird && (
        <WcTournamentPickShare
          eventId={eventId}
          semifinalists={shareSemifinalists}
          champion={shareChampion}
          thirdPlace={shareThird}
          isAuthenticated={isAuthenticated}
          onAuthRequired={onAuthRequired}
        />
      )}
    </Box>
  );
};
