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
  settings: import('@/services/sportsEventLayerService').EventHubSettings;
  onChange: (tab: WcTab) => void;
};

const TAB_SETTINGS: Partial<Record<WcTab, (s: import('@/services/sportsEventLayerService').EventHubSettings) => boolean>> = {
  predictions: (s) => s.predictionsEnabled !== false,
  leaderboard: () => true,
  fans: (s) => s.commentsEnabled !== false || s.fanFeedEnabled !== false,
  groups: (s) => s.standingsEnabled === true,
};

export const WcNav: React.FC<Props> = ({ active, settings, onChange }) => {
  const { t } = useI18n();
  const visibleTabs = WC_TABS.filter((tab) => {
    const gate = TAB_SETTINGS[tab];
    return gate ? gate(settings) : true;
  });

  return (
    <nav className={styles.navWrap} aria-label={t('event_hub.nav_aria')}>
      <div className={styles.navInner}>
        {visibleTabs.map((tab) => (
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
