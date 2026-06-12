import React, { useState } from 'react';
import { Box, Button, MenuItem, Select, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/hooks/useI18n';
import { sportsEventLayerService } from '@/services/sportsEventLayerService';
import type { Fixture } from '@/types/worldCupHub';
import styles from '@/pages/EventHub.module.css';

type Props = {
  eventId: string;
  fixtures: Fixture[];
  threadId: string;
  onThreadChange: (id: string) => void;
  isAuthenticated: boolean;
  onAuthRequired: () => void;
};

const initials = (name?: string) => (name?.trim()?.[0] ?? 'F').toUpperCase();

export const WcFanOpinions: React.FC<Props> = ({
  eventId, fixtures, threadId, onThreadChange, isAuthenticated, onAuthRequired,
}) => {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');

  const { data: opinions = [] } = useQuery({
    queryKey: ['fan-opinions', eventId, threadId],
    queryFn: () => sportsEventLayerService.getTrendingComments(eventId, 'recent'),
    refetchInterval: 45_000,
  });

  const filtered = opinions.filter((o) => o.threadId === threadId).slice(0, 20);
  const match = fixtures.find((f) => f.matchId === threadId);

  const postMutation = useMutation({
    mutationFn: () => sportsEventLayerService.postComment(eventId, {
      threadId,
      threadType: 'match',
      body: body.trim(),
    }),
    onSuccess: () => {
      setBody('');
      queryClient.invalidateQueries({ queryKey: ['fan-opinions', eventId] });
      queryClient.invalidateQueries({ queryKey: ['community-pulse', eventId] });
    },
  });

  return (
    <Box component="section" className={styles.section} id="opinions">
      <Typography component="h2" className={styles.sectionTitle}>{t('event_hub.fan_opinions')}</Typography>
      {fixtures.length > 1 && (
        <Select fullWidth size="small" value={threadId} onChange={(e) => onThreadChange(e.target.value)} className={styles.selectDark} sx={{ mb: 2 }}>
          {fixtures.map((f) => (
            <MenuItem key={f.matchId} value={f.matchId}>{f.teamAName} vs {f.teamBName}</MenuItem>
          ))}
        </Select>
      )}

      {filtered.length === 0 ? (
        <Box className={styles.emptyPremium}>
          <Typography className={styles.emptyTitle}>{t('event_hub.opinions_empty')}</Typography>
        </Box>
      ) : (
        <Box className={styles.opinionFeed}>
          {filtered.map((o) => (
            <Box key={o.commentKey} className={styles.opinionCard}>
              <Box className={styles.opinionAvatar}>{initials(o.userDisplayName)}</Box>
              <Box>
                <Typography className={styles.opinionUser}>{o.userDisplayName ?? t('event_hub.fan')}</Typography>
                <Typography className={styles.opinionBody}>{o.body}</Typography>
                <Typography className={styles.opinionTime}>{new Date(o.createdAt).toLocaleString()}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {isAuthenticated ? (
        <Box className={styles.opinionComposer}>
          <TextField
            fullWidth
            multiline
            rows={2}
            placeholder={match ? t('event_hub.comment_placeholder') : ''}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className={styles.inputDark}
          />
          <Button
            variant="contained"
            className={styles.ctaPrimary}
            sx={{ mt: 1 }}
            disabled={!body.trim() || postMutation.isPending}
            onClick={() => postMutation.mutate()}
          >
            {t('event_hub.post')}
          </Button>
        </Box>
      ) : (
        <Button variant="outlined" className={styles.ctaSecondary} sx={{ mt: 2 }} onClick={onAuthRequired}>
          {t('event_hub.login_to_comment')}
        </Button>
      )}
    </Box>
  );
};
