import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  Box,
  TextField,
  Paper,
  CircularProgress,
  Alert,
  Typography,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { useMe } from '@/hooks/useMe';
import { authService } from '@/services/authService';
import {
  streamAiChat,
  getWorkoutPlan,
  getAiErrorMessage,
  isInsufficientCreditsError,
} from '@/services/aiService';
import type { AiChatMessage } from '@/types/ai';
import styles from './AICoachPage.module.css';
import { trackGeneratePlan } from '@/utils/analytics';
import { loadPremiumCatalog, PREMIUM_ACTION, creditPhrase } from '@/config/premiumCatalog';
import { trackPremiumAction } from '@/utils/analytics';
import { useI18n } from '@/hooks/useI18n';

export const AICoachPage: React.FC = () => {
  const { t } = useI18n();
  const { refreshMe } = useMe();
  const [coachCost, setCoachCost] = useState(1);
  const [workoutCost, setWorkoutCost] = useState(3);
  const [history, setHistory] = useState<AiChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [workoutResult, setWorkoutResult] = useState<{ title: string; summary: string; sessions: string[] } | null>(null);
  const [workoutLoading, setWorkoutLoading] = useState(false);
  const [workoutError, setWorkoutError] = useState('');
  const messagesRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, left: 0, behavior: 'smooth' });
  };

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    void loadPremiumCatalog().then((cat) => {
      setCoachCost(cat.costs[PREMIUM_ACTION.aiCoachMessage] ?? 1);
      setWorkoutCost(cat.costs[PREMIUM_ACTION.aiWorkoutPlan] ?? 3);
    });
  }, []);

  useEffect(() => {
    if (history.length === 0 && !streamingContent) return;
    scrollToBottom();
  }, [history, streamingContent]);

  const handleSend = async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    const token = await authService.getJWT();
    if (!token) {
      setError(t('app_pages.ai.sign_in_again'));
      return;
    }
    setError('');
    setInput('');
    setHistory((prev) => [...prev, { role: 'user', content: msg }]);
    setLoading(true);
    setStreamingContent('');
    let fullReply = '';
    let streamErr: string | undefined;
    try {
      for await (const chunk of streamAiChat(token, msg, history)) {
        if (chunk.error) {
          streamErr = chunk.error;
          setError(chunk.error);
          if (chunk.code === 'INSUFFICIENT_CREDITS' || isInsufficientCreditsError({ response: { status: 402, data: { message: chunk.error } } })) {
            setHistory((prev) => prev.slice(0, -1));
          }
          break;
        }
        if (chunk.text) {
          fullReply += chunk.text;
          setStreamingContent(fullReply);
        }
      }
      if (fullReply && !streamErr) {
        setHistory((prev) => [...prev, { role: 'assistant', content: fullReply }]);
        setStreamingContent('');
        void refreshMe();
        trackPremiumAction('ai_coach_message', 'success');
      }
    } catch (err) {
      setError(getAiErrorMessage(err));
      setHistory((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const handleGetWorkoutPlan = async () => {
    const token = await authService.getJWT();
    if (!token) return;
    setWorkoutError('');
    setWorkoutResult(null);
    setWorkoutLoading(true);
    try {
      const res = await getWorkoutPlan(token, {
        sport: 'Running',
        level: 'intermediate',
        availableDays: ['Mon', 'Wed', 'Fri'],
        durationMinutes: 45,
      });
      setWorkoutResult(res);
      trackGeneratePlan('workout');
      await refreshMe();
      trackPremiumAction('ai_workout_plan', 'success');
    } catch (err) {
      setWorkoutError(getAiErrorMessage(err));
    } finally {
      setWorkoutLoading(false);
    }
  };

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('app_pages.ai.title')}</h1>
        <p className={styles.subtitle}>{t('app_pages.ai.subtitle')}</p>
      </header>

      <Paper className={styles.chatPanel} elevation={0}>
        <div ref={messagesRef} className={styles.messages}>
            {history.length === 0 && !streamingContent && (
              <div className={styles.placeholder}>
                <p>{t('app_pages.ai.ask_anything')}</p>
                <ul>
                  <li>{t('app_pages.ai.tip_1')}</li>
                  <li>{t('app_pages.ai.tip_2')}</li>
                  <li>{t('app_pages.ai.tip_3')}</li>
                  <li>{t('app_pages.ai.tip_4')}</li>
                  <li>{t('app_pages.ai.tip_5')}</li>
                </ul>
              </div>
            )}
            {history.map((m, i) => (
              <div
                key={i}
                className={m.role === 'user' ? styles.messageUser : styles.messageAssistant}
              >
                {m.content}
              </div>
            ))}
            {streamingContent && (
              <div className={styles.messageAssistant}>
                {streamingContent}
                <span className={styles.cursor} />
              </div>
            )}
        </div>

        {error && (
          <Alert severity="error" onClose={() => setError('')} sx={{ mx: 1, mt: 1 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
              {coachCost === 1
                ? t('app_pages.ai.cost_one')
                : `${t('app_pages.ai.cost_many_prefix')} ${creditPhrase(coachCost)}.`}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
              <TextField
                fullWidth
                size="small"
                placeholder={t('app_pages.ai.input_placeholder')}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={loading}
                multiline
                maxRows={3}
              />
              <Button
                variant="contained"
                onClick={handleSend}
                disabled={loading || !input.trim()}
                endIcon={loading ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
              >
                {loading ? '…' : t('app_pages.common.send')}
              </Button>
            </Box>
        </Box>
      </Paper>

      {workoutError && (
        <Alert severity="error" onClose={() => setWorkoutError('')} sx={{ mt: 1, flexShrink: 0 }}>
          {workoutError}
        </Alert>
      )}
      {workoutResult && (
        <div className={styles.workoutCard}>
          <p className={styles.workoutTitle}>{workoutResult.title}</p>
          <p className={styles.workoutSummary}>{workoutResult.summary}</p>
          <ul className={styles.workoutList}>
            {workoutResult.sessions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      <div className={styles.actions}>
        <Button variant="outlined" size="small" onClick={handleGetWorkoutPlan} disabled={workoutLoading}>
          {workoutLoading
            ? t('app_pages.common.generating')
            : `${t('app_pages.ai.generate_workout')} (${creditPhrase(workoutCost)})`}
        </Button>
        <Button variant="outlined" size="small" component={Link} to="/app/chat">
          {t('app_pages.ai.back_to_chat')}
        </Button>
        <Button variant="outlined" size="small" component={Link} to="/pricing">
          {t('header.get_credits')}
        </Button>
      </div>
    </div>
  );
};
