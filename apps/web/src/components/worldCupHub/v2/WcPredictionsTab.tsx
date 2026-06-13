import React from 'react';
import { Box, Typography } from '@mui/material';
import { useI18n } from '@/hooks/useI18n';
import {
  compareMatchesChronological,
  isTbdMatch,
  stageOrder,
  stageI18nKey,
} from '@/utils/eventMatchUtils';
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
  const groupSort = new Map(hub.groups.map((g) => [g.groupId, g.sortOrder]));
  const groupLabel = (groupId?: string) =>
    hub.groups.find((g) => g.groupId === groupId)?.label;

  const sections = new Map<string, StageSection>();
  for (const match of hub.matches) {
    if (match.status === 'Completed') continue;

    if (match.groupId?.trim()) {
      const gid = match.groupId.trim();
      const label = groupLabel(gid) ?? gid;
      const key = `group|${gid}`;
      const section = sections.get(key) ?? {
        order: groupSort.get(gid) ?? 999,
        label,
        matches: [],
      };
      section.matches.push(match);
      sections.set(key, section);
      continue;
    }

    const i18nKey = stageI18nKey(match);
    const label = i18nKey ? t(i18nKey) : (match.stage?.trim() || t('event_hub.stage_group'));
    const key = `stage|${stageOrder(match)}|${label}`;
    const section = sections.get(key) ?? {
      order: 100 + stageOrder(match),
      label,
      matches: [],
    };
    section.matches.push(match);
    sections.set(key, section);
  }

  const ordered = [...sections.values()]
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
    .map((s) => ({
      ...s,
      matches: s.matches.sort((a, b) => {
        const tbd = Number(isTbdMatch(a)) - Number(isTbdMatch(b));
        if (tbd !== 0) return tbd;
        return compareMatchesChronological(a, b);
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
                  hub={hub}
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
