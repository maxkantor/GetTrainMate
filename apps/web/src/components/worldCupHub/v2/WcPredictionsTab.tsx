import React from 'react';
import { Box, Typography } from '@mui/material';
import { useI18n } from '@/hooks/useI18n';
import { isTbdMatch, stageOrder, stageI18nKey } from '@/utils/eventMatchUtils';
import type { EventMatch } from '@/services/sportsEventLayerService';
import type { WcHubProps } from './wcTypes';
import { WcMatchCard } from './WcMatchCard';
import styles from '@/pages/WorldCupV2.module.css';

type Props = Pick<WcHubProps, 'eventId' | 'hub' | 'isAuthenticated' | 'onAuthRequired'>;

type StageSection = {
  order: number;
  label: string;
  matches: EventMatch[];
};

export const WcPredictionsTab: React.FC<Props> = ({ eventId, hub, isAuthenticated, onAuthRequired }) => {
  const { t } = useI18n();
  const groupLabel = (groupId?: string) =>
    hub.groups.find((g) => g.groupId === groupId)?.label;

  const sections = new Map<string, StageSection>();
  for (const match of hub.matches) {
    if (match.status === 'Completed') continue;
    const i18nKey = stageI18nKey(match);
    const label = i18nKey ? t(i18nKey) : (match.stage?.trim() || t('event_hub.stage_group'));
    const key = `${stageOrder(match)}|${label}`;
    const section = sections.get(key) ?? { order: stageOrder(match), label, matches: [] };
    section.matches.push(match);
    sections.set(key, section);
  }

  const sortKey = (m: EventMatch) =>
    `${m.groupId ?? 'zz'}|${m.matchDate ?? ''}${m.matchTime ?? ''}|${m.matchId}`;
  const ordered = [...sections.values()]
    .sort((a, b) => a.order - b.order)
    .map((s) => ({
      ...s,
      matches: s.matches.sort((a, b) => {
        const tbd = Number(isTbdMatch(a)) - Number(isTbdMatch(b));
        if (tbd !== 0) return tbd;
        return sortKey(a).localeCompare(sortKey(b));
      }),
    }));

  return (
    <Box className={styles.tabPanel}>
      <Typography className={styles.sectionTitle}>{t('event_hub.predictions_hub_title')}</Typography>
      <Typography className={styles.sectionLead}>{t('event_hub.predictions_hub_lead')}</Typography>

      {ordered.length === 0 ? (
        <Box className={styles.emptyPremium}>
          <Typography className={styles.emptyTitle}>{t('event_hub.predictions_coming_soon')}</Typography>
          <Typography className={styles.emptyDesc}>{t('event_hub.matches_coming_soon_desc')}</Typography>
        </Box>
      ) : (
        ordered.map((section) => (
          <Box key={section.label} className={styles.stageSection}>
            <Box className={styles.stageHeader}>
              <Typography className={styles.stageTitle}>{section.label}</Typography>
              <span className={styles.stageCount}>{section.matches.length}</span>
            </Box>
            <Box className={styles.matchGrid}>
              {section.matches.map((m) => (
                <WcMatchCard
                  key={m.matchId}
                  eventId={eventId}
                  match={m}
                  groupLabel={groupLabel(m.groupId ?? undefined)}
                  isAuthenticated={isAuthenticated}
                  onAuthRequired={onAuthRequired}
                />
              ))}
            </Box>
          </Box>
        ))
      )}
    </Box>
  );
};
