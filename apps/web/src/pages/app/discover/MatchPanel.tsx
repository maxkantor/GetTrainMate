import React from 'react';
import styles from './MatchPanel.module.css';

interface MatchPanelProps {
  score: number;
  reasons: string[];
  summary?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  compact?: boolean;
}

function getBadgeClass(score: number): string {
  if (score >= 80) return styles.badgeGreen;
  if (score >= 60) return styles.badgeBlue;
  return styles.badgeNeutral;
}

export const MatchPanel: React.FC<MatchPanelProps> = ({
  score,
  reasons,
  summary,
  collapsible = false,
  defaultCollapsed = false,
  compact = false,
}) => {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);

  const badgeClass = getBadgeClass(score);
  const displaySummary =
    summary ||
    (reasons.length > 0
      ? `Strong match: ${reasons.slice(0, 2).join(', ')}.`
      : 'Based on your profile and preferences.');

  return (
    <aside
      className={`${styles.panel} ${compact ? styles.compact : ''}`}
      aria-label={`${score}% match compatibility`}
    >
      <div className={styles.header}>
        <h3 className={styles.title}>
          🔥 <span className={styles.score}>{score}%</span> Match
        </h3>
        <span className={`${styles.badge} ${badgeClass}`} aria-hidden>
          {score >= 80 ? 'Great' : score >= 60 ? 'Good' : 'Fair'}
        </span>
      </div>
      <p className={styles.subtitle}>{displaySummary}</p>
      {reasons.length > 0 && (
        <>
          {collapsible ? (
            <>
              <button
                type="button"
                className={styles.toggleBtn}
                onClick={() => setCollapsed(!collapsed)}
                aria-expanded={!collapsed}
              >
                Why you match {collapsed ? '▼' : '▲'}
              </button>
              {!collapsed && (
                <ul className={styles.reasons}>
                  {reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <ul className={styles.reasons}>
              {reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </aside>
  );
};
