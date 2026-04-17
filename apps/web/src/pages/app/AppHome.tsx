import React, { useMemo, useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Button,
  Card,
  CardActionArea,
  Container,
  Tooltip,
  Typography,
} from '@mui/material';
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined';
import FavoriteBorderOutlinedIcon from '@mui/icons-material/FavoriteBorderOutlined';
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import ForwardToInboxOutlinedIcon from '@mui/icons-material/ForwardToInboxOutlined';
import PsychologyOutlinedIcon from '@mui/icons-material/PsychologyOutlined';
import SkipNextOutlinedIcon from '@mui/icons-material/SkipNextOutlined';
import { useI18n } from '@/hooks/useI18n';
import { useMe } from '@/hooks/useMe';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useMatchStatusForHeader } from '@/hooks/useMatchStatusForHeader';
import { useChatUnreadCount } from '@/hooks/useChatUnreadCount';
import { matchQueryKeys } from '@/lib/queryKeys';
import { fetchSentRequestsForUser, fetchSkippedProfilesForUser } from '@/services/matchExploreQueries';
import { DashboardQuickSetup } from '@/components/dashboard/DashboardQuickSetup';
import {
  consumePostVerifyWelcome,
  peekNewUserDashboardGreeting,
  clearNewUserDashboardGreeting,
} from '@/utils/pendingSignupStorage';

const cardSx = {
  borderRadius: 2,
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: 'background.paper',
  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
  },
};

type Tile = {
  to: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  emphasize?: boolean;
};

export const AppHomePage: React.FC = () => {
  const { t } = useI18n();
  const { me } = useMe();
  const { user } = useAuthContext();
  /** First session after email verification — not used for returning users with incomplete profiles */
  const [firstTimeDashboardCopy, setFirstTimeDashboardCopy] = useState(() => peekNewUserDashboardGreeting());

  useEffect(() => {
    if (consumePostVerifyWelcome()) setFirstTimeDashboardCopy(true);
  }, []);

  useEffect(() => {
    if (me?.isProfileComplete) {
      clearNewUserDashboardGreeting();
      setFirstTimeDashboardCopy(false);
    }
  }, [me?.isProfileComplete]);
  const userSub = user?.sub ?? '';
  const matchStatus = useMatchStatusForHeader(!!me?.user?.id);
  const chatUnread = useChatUnreadCount();

  const sentEnabled =
    !!userSub && me?.profile?.discoverCanReviewLikedProfiles !== false;
  const skippedEnabled =
    !!userSub && me?.profile?.discoverCanReviewSkippedProfiles !== false;

  const { data: sentItems } = useQuery({
    queryKey: matchQueryKeys.sentRequests(userSub),
    queryFn: () => fetchSentRequestsForUser(userSub),
    enabled: sentEnabled,
    staleTime: 45_000,
  });
  const { data: skippedItems } = useQuery({
    queryKey: matchQueryKeys.skippedProfiles(userSub),
    queryFn: () => fetchSkippedProfilesForUser(userSub),
    enabled: skippedEnabled,
    staleTime: 45_000,
  });

  const sentPending =
    sentItems != null ? sentItems.filter((s) => s.status === 'Pending').length : null;
  const matchesCount = matchStatus.loading ? null : matchStatus.totalMatches;
  const skippedCount = skippedItems != null ? skippedItems.length : null;

  const first = me?.profile?.name?.trim()?.split(/\s+/)[0];
  const greeting = first || t('app_pages.home.greeting_fallback_name');
  const credits = me?.credits ?? 0;
  const needsQuickSetup = Boolean(me && !me.isProfileComplete);

  const tiles: Tile[] = useMemo(() => {
    const matchesSub = matchStatus.loading
      ? t('app_pages.common.loading')
      : `${matchStatus.totalMatches} ${t(
          matchStatus.totalMatches === 1
            ? 'app_pages.home.mutual_match_one'
            : 'app_pages.home.mutual_match_many'
        )}`;
    const chatSub =
      chatUnread > 0
        ? `${chatUnread} ${t(chatUnread === 1 ? 'app_pages.home.unread_one' : 'app_pages.home.unread_many')}`
        : t('app_pages.home.chat_with_mutuals');
    const eventsCity = me?.profile?.eventsCityInterest || me?.profile?.city;
    const eventsSub = me?.profile?.eventsWaitlistEnabled
      ? eventsCity
        ? `${t('app_pages.home.waitlist_joined_for')} ${eventsCity}`
        : t('app_pages.home.waitlist_notify_local')
      : t('app_pages.home.waitlist_get_notified');
    const profileSub = t('app_pages.home.profile_sub');
    const aiSub = t('app_pages.home.ai_sub');

    const list: Tile[] = [
      {
        to: '/app/matches',
        title: t('nav.match'),
        subtitle: matchesSub,
        icon: <FavoriteBorderOutlinedIcon sx={{ fontSize: 32, opacity: 0.9 }} />,
      },
    ];

    if (me?.profile?.discoverCanReviewLikedProfiles !== false) {
      const sentSub =
        sentPending != null && sentPending > 0
          ? `${sentPending} ${t(
              sentPending === 1 ? 'app_pages.home.pending_invite_one' : 'app_pages.home.pending_invite_many'
            )}`
          : t('app_pages.home.outgoing_likes_responses');
      list.push({
        to: '/app/sent-requests',
        title: t('nav.sent'),
        subtitle: sentSub,
        icon: <ForwardToInboxOutlinedIcon sx={{ fontSize: 32, opacity: 0.9 }} />,
      });
    }

    if (me?.profile?.discoverCanReviewSkippedProfiles !== false) {
      list.push({
        to: '/app/skipped',
        title: t('nav.skipped'),
        subtitle: t('app_pages.home.skipped_subtitle'),
        icon: <SkipNextOutlinedIcon sx={{ fontSize: 32, opacity: 0.9 }} />,
      });
    }

    list.push(
      {
        to: '/app/chat',
        title: t('nav.chat'),
        subtitle: chatSub,
        icon: <ChatBubbleOutlineOutlinedIcon sx={{ fontSize: 32, opacity: 0.9 }} />,
        emphasize: chatUnread > 0,
      },
      {
        to: '/app/events',
        title: t('nav.events'),
        subtitle: eventsSub,
        icon: <EventOutlinedIcon sx={{ fontSize: 32, opacity: 0.9 }} />,
      },
      {
        to: '/app/profile',
        title: t('nav.profile'),
        subtitle: profileSub,
        icon: <PersonOutlineOutlinedIcon sx={{ fontSize: 32, opacity: 0.9 }} />,
      },
      {
        to: '/app/ai-coach',
        title: t('nav.ai_coach'),
        subtitle: aiSub,
        icon: <PsychologyOutlinedIcon sx={{ fontSize: 32, opacity: 0.9 }} />,
      }
    );

    return list;
  }, [
    t,
    matchStatus.loading,
    matchStatus.totalMatches,
    chatUnread,
    me?.profile?.discoverCanReviewLikedProfiles,
    me?.profile?.discoverCanReviewSkippedProfiles,
    sentPending,
    me?.profile?.eventsWaitlistEnabled,
    me?.profile?.eventsCityInterest,
    me?.profile?.city,
  ]);

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, sm: 5 } }}>
      <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.12em' }}>
        {t('app_pages.home.dashboard_label')}
      </Typography>
      {firstTimeDashboardCopy ? (
        <>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 800, mt: 0.5, mb: 1 }}>
            You&apos;re in. Let&apos;s get you matched.
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2, maxWidth: 560 }}>
            Let&apos;s set up your training preferences and find your people.
          </Typography>
        </>
      ) : (
        <Typography variant="h4" component="h1" sx={{ fontWeight: 800, mt: 0.5, mb: 1 }}>
          {t('app_pages.home.welcome_back')}, {greeting}
        </Typography>
      )}
      <Tooltip title={t('app_pages.home.credit_hint')} placement="top" arrow>
        <Typography
          component="span"
          variant="body2"
          color="text.secondary"
          sx={{ display: 'inline-block', mb: 2, cursor: 'default', borderBottom: '1px dotted', borderColor: 'divider' }}
        >
          {credits} {t('app_pages.home.credits_left')}
        </Typography>
      </Tooltip>
      {!needsQuickSetup ? (
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{
            mb: 2,
            maxWidth: { xs: '100%', sm: 'fit-content' },
            whiteSpace: { xs: 'normal', sm: 'nowrap' },
            overflow: { xs: 'visible', sm: 'hidden' },
            textOverflow: { xs: 'clip', sm: 'ellipsis' },
          }}
        >
          {t('app_pages.home.quick_access')}
        </Typography>
      ) : !firstTimeDashboardCopy ? (
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2, maxWidth: 560 }}>
          Let&apos;s set up your training preferences. We&apos;ll use this to find better matches.
        </Typography>
      ) : null}

      {needsQuickSetup ? <DashboardQuickSetup /> : null}

      {!needsQuickSetup ? (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1.5,
            mb: 2,
            typography: 'caption',
            color: 'text.secondary',
          }}
        >
          <Box component="span">
            {t('app_pages.home.matches_label')}:{' '}
            <Box component="span" sx={{ color: 'text.primary', fontWeight: 700 }}>
              {matchesCount == null ? '…' : matchesCount}
            </Box>
          </Box>
          <Box component="span" sx={{ opacity: 0.4 }}>
            ·
          </Box>
          <Box component="span">
            {t('app_pages.home.pending_sent_label')}:{' '}
            <Box component="span" sx={{ color: 'text.primary', fontWeight: 700 }}>
              {sentPending == null ? '…' : sentPending}
            </Box>
          </Box>
          {skippedEnabled ? (
            <>
              <Box component="span" sx={{ opacity: 0.4 }}>
                ·
              </Box>
              <Box component="span">
                {t('nav.skipped')}:{' '}
                <Box component="span" sx={{ color: 'text.primary', fontWeight: 700 }}>
                  {skippedCount == null ? '…' : skippedCount}
                </Box>
              </Box>
            </>
          ) : null}
          <Box component="span" sx={{ opacity: 0.4 }}>
            ·
          </Box>
          <Box component="span">
            {t('app_pages.home.unread_chats_label')}:{' '}
            <Box component="span" sx={{ color: chatUnread > 0 ? 'primary.main' : 'text.primary', fontWeight: 700 }}>
              {chatUnread}
            </Box>
          </Box>
        </Box>
      ) : null}

      {!needsQuickSetup ? (
        <Button
          component={RouterLink}
          to="/app/discover"
          variant="contained"
          size="large"
          fullWidth
          startIcon={<ExploreOutlinedIcon />}
          sx={{ mb: 3, py: 1.5, fontWeight: 600 }}
        >
          {t('app_pages.home.start_discovering')}
        </Button>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
          gap: 2,
        }}
      >
        {tiles.map((item) => (
          <Card
            key={item.to}
            variant="outlined"
            sx={{
              ...cardSx,
              ...(item.emphasize
                ? {
                    borderColor: 'primary.main',
                    boxShadow: '0 0 0 1px rgba(129, 140, 248, 0.35)',
                  }
                : {}),
            }}
          >
            <CardActionArea
              component={RouterLink}
              to={item.to}
              sx={{ p: 2.5, alignItems: 'stretch', minHeight: 120 }}
            >
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                <Box sx={{ color: 'primary.main', pt: 0.25 }}>{item.icon}</Box>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {item.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {item.subtitle}
                  </Typography>
                </Box>
              </Box>
            </CardActionArea>
          </Card>
        ))}
      </Box>
    </Container>
  );
};
