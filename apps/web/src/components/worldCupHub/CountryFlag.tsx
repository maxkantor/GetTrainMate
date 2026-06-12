import React from 'react';
import { flagCdnUrl } from '@/utils/teamFlags';
import styles from './CountryFlag.module.css';

type Props = {
  teamId?: string | null;
  /** Fallback when teamId is unknown (emoji — may render as letters on Windows). */
  flagEmoji?: string | null;
  size?: number;
  className?: string;
  alt?: string;
};

/** Cross-platform flag — uses flagcdn images instead of emoji regional indicators. */
export const CountryFlag: React.FC<Props> = ({
  teamId, size = 28, className = '', alt = '',
}) => {
  const src = flagCdnUrl(teamId, size);
  if (src) {
    return (
      <img
        src={src}
        width={size}
        height={Math.round(size * 0.72)}
        alt={alt}
        className={`${styles.flagImg} ${className}`.trim()}
        loading="lazy"
        decoding="async"
      />
    );
  }
  return (
    <span className={`${styles.flagPlaceholder} ${className}`.trim()} aria-hidden title={alt}>
      🏳️
    </span>
  );
};
