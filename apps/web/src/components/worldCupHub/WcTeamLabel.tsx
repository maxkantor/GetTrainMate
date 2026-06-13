import React from 'react';
import { CountryFlag } from '@/components/worldCupHub/CountryFlag';
import { useWcDisplay } from '@/hooks/useWcDisplay';
import styles from '@/pages/WorldCupV2.module.css';

type Props = {
  teamId: string;
  fallbackName?: string;
  flagEmoji?: string | null;
  size?: number;
  className?: string;
  nameClassName?: string;
};

/** Flag image + full country name — never FIFA codes or emoji letter fallbacks. */
export const WcTeamLabel: React.FC<Props> = ({
  teamId, fallbackName, flagEmoji, size = 22, className = '', nameClassName = '',
}) => {
  const { teamName } = useWcDisplay();
  const label = teamName(teamId, fallbackName);

  return (
    <span className={`${styles.teamLabel} ${className}`.trim()}>
      <CountryFlag teamId={teamId} flagEmoji={flagEmoji} size={size} alt={label} />
      <span className={`${styles.teamLabelName} ${nameClassName}`.trim()}>{label}</span>
    </span>
  );
};
