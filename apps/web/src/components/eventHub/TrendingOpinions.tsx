import React, { useState } from 'react';
import { Box, Button, Tab, Tabs, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/hooks/useI18n';
import { ComingSoon } from '@/components/eventHub/ComingSoon';
import { sportsEventLayerService } from '@/services/sportsEventLayerService';
import styles from '@/pages/EventHub.module.css';

type Props = {
  eventId: string;
  enabled: boolean;
  isAuthenticated: boolean;
  defaultThreadId?: string;
  onLogin: () => void;
};

export const TrendingOpinions: React.FC<Props> = ({ eventId, enabled, isAuthenticated, defaultThreadId, onLogin }) => {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [sort, setSort] = useState<'trending' | 'recent'>('trending');
  const [body, setBody] = useState('');
  const [threadId, setThreadId] = useState(defaultThreadId ?? '');

  const { data: comments = [] } = useQuery({
    queryKey: ['trending-comments', eventId, sort],
    queryFn: () => sportsEventLayerService.getTrendingComments(eventId, sort),
    enabled,
    refetchInterval: 45_000,
  });

  const postMutation = useMutation({
    mutationFn: () => sportsEventLayerService.postComment(eventId, { threadId: threadId || 'general', threadType: 'match', body }),
    onSuccess: () => {
      setBody('');
      queryClient.invalidateQueries({ queryKey: ['trending-comments', eventId] });
    },
  });

  const likeMutation = useMutation({
    mutationFn: (key: string) => sportsEventLayerService.likeComment(eventId, key),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trending-comments', eventId] }),
  });

  if (!enabled) return null;

  return (
    <Box component="section" className={styles.section} id="discussions">
      <Typography component="h2" className={styles.sectionTitle}>{t('event_hub.trending_opinions')}</Typography>
      <Tabs value={sort} onChange={(_, v) => setSort(v)} className={styles.feedTabs}>
        <Tab label={t('event_hub.trending')} value="trending" />
        <Tab label={t('event_hub.most_recent')} value="recent" />
      </Tabs>

      {comments.length === 0 ? (
        <ComingSoon title={t('event_hub.discussions_coming_soon')} description={t('event_hub.be_first_fan')} />
      ) : (
        <Box className={styles.feedList}>
          {comments.map((c) => (
            <Box key={c.commentKey} className={styles.feedCard}>
              <Box className={styles.feedHeader}>
                <Typography className={styles.feedAuthor}>{c.userDisplayName ?? t('event_hub.fan')}</Typography>
                <Typography className={styles.feedTime}>{new Date(c.createdAt).toLocaleDateString()}</Typography>
              </Box>
              <Typography className={styles.feedBody}>{c.body}</Typography>
              <Box className={styles.feedActions}>
                <Button size="small" onClick={() => isAuthenticated ? likeMutation.mutate(c.commentKey) : onLogin()}>
                  ❤️ {c.likeCount ?? 0}
                </Button>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {isAuthenticated ? (
        <Box className={styles.feedComposer}>
          <TextField fullWidth size="small" placeholder={t('event_hub.comment_placeholder')} value={body} onChange={(e) => setBody(e.target.value)} className={styles.inputDark} />
          <Button variant="contained" className={styles.ctaPrimary} disabled={!body.trim()} onClick={() => postMutation.mutate()}>
            {t('event_hub.post')}
          </Button>
        </Box>
      ) : (
        <Button variant="outlined" className={styles.ctaSecondary} onClick={onLogin} sx={{ mt: 2 }}>
          {t('event_hub.login_to_comment')}
        </Button>
      )}
    </Box>
  );
};
