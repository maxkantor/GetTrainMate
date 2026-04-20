import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { Link as RouterLink } from 'react-router-dom';
import { useI18n } from '@/hooks/useI18n';
import { formatI18n } from '@/i18n';
import { useMe } from '@/hooks/useMe';
import {
  PREMIUM_ACTION,
  loadPremiumCatalog,
  creditPhrase,
  getFallbackPremiumCost,
  type PremiumCatalog,
} from '@/config/premiumCatalog';
import { analytics } from '@/utils/analytics';
import styles from './CreditsUsageModal.module.css';

type SectionId = 'discover' | 'chat' | 'ai' | 'visibility';

type RowDef =
  | { kind: 'fixed'; section: SectionId; cost: number; titleKey: string; descKey: string }
  | {
      kind: 'catalog';
      section: SectionId;
      actionKey: string;
      titleKey: string;
      descKey: string;
    };

const ROWS: RowDef[] = [
  {
    kind: 'fixed',
    section: 'discover',
    cost: 1,
    titleKey: 'credits_usage.row_send_interest_title',
    descKey: 'credits_usage.row_send_interest_desc',
  },
  {
    kind: 'catalog',
    section: 'chat',
    actionKey: PREMIUM_ACTION.unlockChat,
    titleKey: 'credits_usage.row_unlock_chat_title',
    descKey: 'credits_usage.row_unlock_chat_desc',
  },
  {
    kind: 'catalog',
    section: 'chat',
    actionKey: PREMIUM_ACTION.aiIcebreaker,
    titleKey: 'credits_usage.row_icebreaker_title',
    descKey: 'credits_usage.row_icebreaker_desc',
  },
  {
    kind: 'catalog',
    section: 'ai',
    actionKey: PREMIUM_ACTION.aiCoachMessage,
    titleKey: 'credits_usage.row_ai_coach_title',
    descKey: 'credits_usage.row_ai_coach_desc',
  },
  {
    kind: 'catalog',
    section: 'ai',
    actionKey: PREMIUM_ACTION.deeperMatchInsight,
    titleKey: 'credits_usage.row_match_insight_title',
    descKey: 'credits_usage.row_match_insight_desc',
  },
  {
    kind: 'catalog',
    section: 'ai',
    actionKey: PREMIUM_ACTION.aiWorkoutPlan,
    titleKey: 'credits_usage.row_workout_plan_title',
    descKey: 'credits_usage.row_workout_plan_desc',
  },
  {
    kind: 'catalog',
    section: 'ai',
    actionKey: PREMIUM_ACTION.aiProfileRewrite,
    titleKey: 'credits_usage.row_profile_rewrite_title',
    descKey: 'credits_usage.row_profile_rewrite_desc',
  },
  {
    kind: 'catalog',
    section: 'visibility',
    actionKey: PREMIUM_ACTION.profileBoost24h,
    titleKey: 'credits_usage.row_boost_title',
    descKey: 'credits_usage.row_boost_desc',
  },
  {
    kind: 'catalog',
    section: 'visibility',
    actionKey: PREMIUM_ACTION.revealLikes,
    titleKey: 'credits_usage.row_reveal_likes_title',
    descKey: 'credits_usage.row_reveal_likes_desc',
  },
];

const SECTION_ORDER: SectionId[] = ['discover', 'chat', 'ai', 'visibility'];

function sectionLabelKey(s: SectionId): string {
  switch (s) {
    case 'discover':
      return 'credits_usage.section_discover';
    case 'chat':
      return 'credits_usage.section_chat';
    case 'ai':
      return 'credits_usage.section_ai';
    case 'visibility':
      return 'credits_usage.section_visibility';
    default:
      return '';
  }
}

export type CreditsUsageModalProps = {
  open: boolean;
  onClose: () => void;
  /** For analytics only */
  source?: string;
};

export const CreditsUsageModal: React.FC<CreditsUsageModalProps> = ({ open, onClose, source = 'unknown' }) => {
  const { t } = useI18n();
  const { me } = useMe();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [catalog, setCatalog] = useState<PremiumCatalog | null>(null);

  useEffect(() => {
    if (!open) return;
    analytics.creditsUsageOpened(source);
    void loadPremiumCatalog().then(setCatalog);
  }, [open, source]);

  const costForRow = (row: RowDef): number => {
    if (row.kind === 'fixed') return row.cost;
    return catalog?.costs[row.actionKey] ?? getFallbackPremiumCost(row.actionKey);
  };

  const rowsBySection = useMemo(() => {
    const map = new Map<SectionId, RowDef[]>();
    for (const s of SECTION_ORDER) map.set(s, []);
    for (const row of ROWS) {
      const list = map.get(row.section);
      if (list) list.push(row);
    }
    return map;
  }, []);

  const credits = me?.credits ?? 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      fullScreen={fullScreen}
      scroll="paper"
      aria-labelledby="credits-usage-title"
      PaperProps={{ className: styles.dialogPaper }}
    >
      <DialogContent sx={{ pt: 3, pb: 1, px: { xs: 2, sm: 3 } }}>
        <div className={styles.header}>
          <div>
            <div className={styles.kicker}>
              <AutoAwesomeIcon sx={{ fontSize: 18, opacity: 0.9 }} aria-hidden />
              {t('credits_usage.modal_kicker')}
            </div>
            <h2 id="credits-usage-title" className={styles.title}>
              {t('credits_usage.modal_title')}
            </h2>
            <p className={styles.subtitle}>{t('credits_usage.modal_subtitle')}</p>
            {me != null && (
              <div className={styles.balanceBar}>
                {formatI18n(t('credits_usage.balance_line'), { credits })}
              </div>
            )}
          </div>
          <IconButton
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label={t('common.close')}
            size="small"
          >
            <CloseIcon />
          </IconButton>
        </div>

        <div className={styles.scroll}>
          {SECTION_ORDER.map((section) => {
            const rows = rowsBySection.get(section) ?? [];
            if (!rows.length) return null;
            return (
              <section key={section} className={styles.section} aria-labelledby={`section-${section}`}>
                <h3 id={`section-${section}`} className={styles.sectionLabel}>
                  {t(sectionLabelKey(section))}
                </h3>
                {rows.map((row, idx) => {
                  const cost = costForRow(row);
                  const title =
                    row.kind === 'fixed' ? t(row.titleKey) : t(row.titleKey);
                  const desc =
                    row.kind === 'fixed' ? t(row.descKey) : t(row.descKey);
                  const key =
                    row.kind === 'fixed' ? `fixed-${row.titleKey}-${idx}` : `${row.actionKey}-${idx}`;
                  return (
                    <div key={key} className={styles.row}>
                      <div>
                        <p className={styles.rowTitle}>{title}</p>
                        <p className={styles.rowDesc}>{desc}</p>
                      </div>
                      <span className={styles.costPill}>{creditPhrase(cost)}</span>
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>

        <p className={styles.disclaimer}>{t('credits_usage.disclaimer')}</p>
      </DialogContent>

      <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: 3, pt: 0, flexWrap: 'wrap' }} className={styles.actions}>
        <Button type="button" variant="text" className={styles.btnGhost} onClick={onClose}>
          {t('credits_usage.close')}
        </Button>
        <Button
          component={RouterLink}
          to="/pricing"
          variant="contained"
          className={styles.btnPrimary}
          onClick={() => {
            analytics.pricingClicked(`credits_usage_${source}`);
            onClose();
          }}
        >
          {t('header.get_credits')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
