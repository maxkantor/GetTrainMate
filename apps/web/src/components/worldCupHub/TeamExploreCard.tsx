import React from 'react';
import { CountryFlag } from './CountryFlag';
import styles from './TeamExploreCard.module.css';

type Props = {
  teamId: string;
  name: string;
  flagEmoji?: string;
  subtitle?: string;
  onClick?: () => void;
  footer?: React.ReactNode;
  as?: 'button' | 'div';
};

/** Premium team tile with real flag image — used in Groups explorer and Find Fans. */
export const TeamExploreCard: React.FC<Props> = ({
  teamId, name, flagEmoji, subtitle, onClick, footer, as = 'button',
}) => {
  const Tag = as === 'button' ? 'button' : 'div';
  const interactive = as === 'button' && Boolean(onClick);

  return (
    <Tag
      type={as === 'button' ? 'button' : undefined}
      className={styles.card}
      onClick={onClick}
      {...(interactive ? {} : { role: onClick ? 'button' : undefined, tabIndex: onClick ? 0 : undefined })}
    >
      <span className={styles.flagWrap}>
        <CountryFlag teamId={teamId} flagEmoji={flagEmoji} size={44} alt={name} className={styles.flag} />
      </span>
      <span className={styles.name}>{name}</span>
      {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      {footer && <span className={styles.footer}>{footer}</span>}
    </Tag>
  );
};
