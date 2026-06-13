import React from 'react';
import { useI18n } from '@/hooks/useI18n';
import { WC_TABS, type WcTab } from './wcTypes';
import styles from '@/pages/WorldCupV2.module.css';

const TAB_I18N: Record<WcTab, string> = {
  overview: 'event_hub.tab_overview',
  groups: 'event_hub.tab_groups',
  matches: 'event_hub.tab_matches',
  predictions: 'event_hub.tab_predictions',
  leaderboard: 'event_hub.tab_leaderboard',
  fans: 'event_hub.tab_fans',
  'my-picks': 'event_hub.tab_my_picks',
};

type Props = {
  active: WcTab;
  onChange: (tab: WcTab) => void;
};

export const WcNav: React.FC<Props> = ({ active, onChange }) => {
  const { t } = useI18n();

  return (
    <nav className={styles.navWrap} aria-label={t('event_hub.nav_aria')}>
      <div className={styles.navInner}>
        {WC_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`${styles.navTab} ${active === tab ? styles.navTabActive : ''}`}
            onClick={() => onChange(tab)}
            aria-current={active === tab ? 'page' : undefined}
          >
            {t(TAB_I18N[tab])}
          </button>
        ))}
      </div>
    </nav>
  );
};
