import React from 'react';
import type { EventMatch } from '@/services/sportsEventLayerService';
import { useI18n } from '@/hooks/useI18n';
import { useWcDisplay } from '@/hooks/useWcDisplay';
import { CountryFlag } from './CountryFlag';
import styles from './MatchFlagPair.module.css';

type Props = {
  match: Pick<EventMatch, 'teamAId' | 'teamBId' | 'teamAFlag' | 'teamBFlag' | 'teamAName' | 'teamBName'>;
  size?: number;
};

/** Two country flags with a vs divider — for fan wall, picks, etc. */
export const MatchFlagPair: React.FC<Props> = ({ match, size = 20 }) => {
  const { t } = useI18n();
  const { teamName } = useWcDisplay();

  return (
    <span className={styles.pair}>
      <CountryFlag teamId={match.teamAId} flagEmoji={match.teamAFlag} size={size} alt={teamName(match.teamAId, match.teamAName)} />
      <span className={styles.vs}>{t('event_hub.vs')}</span>
      <CountryFlag teamId={match.teamBId} flagEmoji={match.teamBFlag} size={size} alt={teamName(match.teamBId, match.teamBName)} />
    </span>
  );
};
