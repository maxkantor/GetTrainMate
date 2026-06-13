import { useCallback } from 'react';
import { useI18n } from '@/hooks/useI18n';
import type { PredictionOutcomeShare } from '@/services/sportsEventLayerService';
import { getLocalizedGroupLabel, getLocalizedTeamName } from '@/utils/wcDisplayNames';

export function useWcDisplay() {
  const { locale, t } = useI18n();

  const teamName = useCallback(
    (teamId: string | undefined, fallbackName?: string) =>
      getLocalizedTeamName(teamId, fallbackName, locale),
    [locale]
  );

  const groupLabel = useCallback(
    (groupId: string | undefined, fallbackLabel?: string) =>
      getLocalizedGroupLabel(groupId, fallbackLabel, locale, t('event_hub.group_label')),
    [locale, t]
  );

  const matchLine = useCallback(
    (teamAId: string | undefined, teamAName: string | undefined, teamBId: string | undefined, teamBName: string | undefined) =>
      `${teamName(teamAId, teamAName)} ${t('event_hub.vs')} ${teamName(teamBId, teamBName)}`,
    [teamName, t]
  );

  const outcomeLabel = useCallback(
    (outcome: Pick<PredictionOutcomeShare, 'label' | 'teamId' | 'outcomeType'>) => {
      if (outcome.outcomeType === 'draw') return t('event_hub.pick_draw');
      if (outcome.teamId) return teamName(outcome.teamId, outcome.label);
      return outcome.label;
    },
    [teamName, t]
  );

  return { teamName, groupLabel, matchLine, outcomeLabel, locale };
}
