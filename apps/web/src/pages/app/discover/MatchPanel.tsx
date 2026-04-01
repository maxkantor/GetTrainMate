import React from 'react';
import styles from './MatchPanel.module.css';

export interface MatchInsightDisplay {
  summary: string;
  reasons: string[];
  caution?: string;
}

interface MatchPanelProps {
  score: number;
  reasons: string[];
  summary?: string;
  /** AI-generated match insight (when unlocked); when absent, show unlock teaser. */
  aiMatchInsight?: string;
  /** Full AI insight (summary + reasons + caution) when unlocked via API. */
  aiMatchInsightFull?: MatchInsightDisplay;
  /** Credit cost to show in teaser (e.g. 2). */
  aiInsightCreditCost?: number;
  /** Callback when user clicks Unlock AI match insight. */
  onUnlockAiInsight?: () => void;
  /** True while insight is loading. */
  aiInsightLoading?: boolean;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  compact?: boolean;
}

function getBadgeClass(score: number): string {
  if (score >= 80) return styles.badgeGreen;
  if (score >= 60) return styles.badgeBlue;
  return styles.badgeNeutral;
}

/** Aligns short copy with the same tiers as the badge (Fair / Good / Great). */
function matchStrengthPhrase(score: number): string {
  if (score >= 80) return 'Strong match';
  if (score >= 60) return 'Good match';
  if (score >= 40) return 'Fair match';
  return 'Early match';
}

export const MatchPanel: React.FC<MatchPanelProps> = ({
  score,
  reasons,
  summary,
  aiMatchInsight,
  aiMatchInsightFull,
  aiInsightCreditCost = 2,
  onUnlockAiInsight,
  aiInsightLoading = false,
  collapsible = false,
  defaultCollapsed = false,
  compact = false,
}) => {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);

  const badgeClass = getBadgeClass(score);
  const strength = matchStrengthPhrase(score);
  const displaySummary =
    summary ||
    (reasons.length > 0
      ? `${strength}: ${reasons.slice(0, 2).join(', ')}.`
      : 'Based on your profile and preferences.');

  return (
    <aside
      className={`${styles.panel} ${compact ? styles.compact : ''}`}
      aria-label={`${score}% match compatibility`}
    >
      <div className={styles.header}>
        <div className={styles.scoreWrap}>
          <span className={styles.score}>{score}%</span>
          <h3 className={styles.title}>Match</h3>
        </div>
        <span className={`${styles.badge} ${badgeClass}`} aria-hidden>
          {score >= 80 ? 'Strong' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Early'}
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
      {(aiMatchInsight || aiMatchInsightFull) ? (
        <div className={styles.aiInsightBlock}>
          <span className={styles.aiInsightLabel}>AI Insight</span>
          <p className={styles.aiInsightText}>
            {aiMatchInsightFull ? aiMatchInsightFull.summary : aiMatchInsight}
          </p>
          {aiMatchInsightFull?.reasons && aiMatchInsightFull.reasons.length > 0 && (
            <ul className={styles.aiInsightReasons}>
              {aiMatchInsightFull.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
          {aiMatchInsightFull?.caution && (
            <p className={styles.aiInsightCaution}>{aiMatchInsightFull.caution}</p>
          )}
        </div>
      ) : (
        <div className={styles.aiInsightTeaserWrap}>
          <p className={styles.aiInsightUpsell}>Get a deeper compatibility read before you decide.</p>
          {onUnlockAiInsight ? (
            <button
              type="button"
              className={styles.aiInsightUnlockBtn}
              onClick={onUnlockAiInsight}
              disabled={aiInsightLoading}
            >
              {aiInsightLoading
                ? 'Generating…'
                : `Unlock why you match (${aiInsightCreditCost} credit${aiInsightCreditCost !== 1 ? 's' : ''})`}
            </button>
          ) : (
            <p className={styles.aiInsightTeaser}>
              Unlock why you match ({aiInsightCreditCost} credit{aiInsightCreditCost !== 1 ? 's' : ''})
            </p>
          )}
        </div>
      )}
    </aside>
  );
};
