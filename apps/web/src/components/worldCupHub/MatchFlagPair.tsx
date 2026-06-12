import React from 'react';
import type { EventMatch } from '@/services/sportsEventLayerService';
import { CountryFlag } from './CountryFlag';
import styles from './MatchFlagPair.module.css';

type Props = {
  match: Pick<EventMatch, 'teamAId' | 'teamBId' | 'teamAFlag' | 'teamBFlag' | 'teamAName' | 'teamBName'>;
  size?: number;
};

/** Two country flags with a vs divider — for fan wall, picks, etc. */
export const MatchFlagPair: React.FC<Props> = ({ match, size = 20 }) => (
  <span className={styles.pair}>
    <CountryFlag teamId={match.teamAId} flagEmoji={match.teamAFlag} size={size} alt={match.teamAName ?? ''} />
    <span className={styles.vs}>vs</span>
    <CountryFlag teamId={match.teamBId} flagEmoji={match.teamBFlag} size={size} alt={match.teamBName ?? ''} />
  </span>
);
