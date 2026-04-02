import React, { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Card, CardActionArea, Container, Typography } from '@mui/material';
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
import { useMatchStatusForHeader } from '@/hooks/useMatchStatusForHeader';
import { useChatUnreadCount } from '@/hooks/useChatUnreadCount';
import { authService } from '@/services/authService';
import { matchService } from '@/services/matchService';
import { isGraphQLEnabled } from '@/services/graphqlService';

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
};

export const AppHomePage: React.FC = () => {
  const { t } = useI18n();
  const { me } = useMe();
  const matchStatus = useMatchStatusForHeader(!!me?.user?.id);
  const chatUnread = useChatUnreadCount();
  const [sentPending, setSentPending] = useState<number | null>(null);

  const first = me?.profile?.name?.trim()?.split(/\s+/)[0];
  const greeting = first || 'there';
  const credits = me?.credits ?? 0;

  useEffect(() => {
    if (!me?.user?.id || isGraphQLEnabled) {
      setSentPending(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const token = await authService.getJWT();
      if (!token || cancelled) return;
      try {
        const sent = await matchService.getSentRequests(token);
        if (!cancelled) setSentPending(sent.filter((s) => s.status === 'Pending').length);
      } catch {
        if (!cancelled) setSentPending(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [me?.user?.id]);

  const tiles: Tile[] = useMemo(() => {
    const discoverSub = 'Browse by shared intent — Train, Vibe, or Date';
    const matchesSub = matchStatus.loading
      ? 'Loading…'
      : `${matchStatus.totalMatches} mutual match${matchStatus.totalMatches === 1 ? '' : 'es'}`;
    const chatSub =
      chatUnread > 0 ? `${chatUnread} unread message${chatUnread === 1 ? '' : 's'}` : 'Messages with mutual matches';
    const eventsSub = 'Train together IRL when events go live';
    const profileSub =
      credits > 0 ? `${credits} credits · photos, bio, modes, schedule` : 'Photos, bio, modes, schedule';
    const aiSub = 'Workouts and training guidance';

    const list: Tile[] = [
      {
        to: '/app/discover',
        title: t('nav.discover'),
        subtitle: discoverSub,
        icon: <ExploreOutlinedIcon sx={{ fontSize: 32, opacity: 0.9 }} />,
      },
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
          ? `${sentPending} pending invite${sentPending === 1 ? '' : 's'}`
          : 'Outgoing likes and responses';
      list.push({
        to: '/app/sent-requests',
        title: 'Sent',
        subtitle: isGraphQLEnabled ? 'REST app for full sent list' : sentSub,
        icon: <ForwardToInboxOutlinedIcon sx={{ fontSize: 32, opacity: 0.9 }} />,
      });
    }

    if (me?.profile?.discoverCanReviewSkippedProfiles !== false) {
      list.push({
        to: '/app/skipped',
        title: 'Skipped',
        subtitle: 'Profiles you passed — stay out of Discover unless recycled by policy',
        icon: <SkipNextOutlinedIcon sx={{ fontSize: 32, opacity: 0.9 }} />,
      });
    }

    list.push(
      {
        to: '/app/chat',
        title: t('nav.chat'),
        subtitle: chatSub,
        icon: <ChatBubbleOutlineOutlinedIcon sx={{ fontSize: 32, opacity: 0.9 }} />,
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
        title: 'AI Coach',
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
    credits,
    me?.profile?.discoverCanReviewLikedProfiles,
    me?.profile?.discoverCanReviewSkippedProfiles,
    sentPending,
  ]);

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, sm: 5 } }}>
      <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.12em' }}>
        Dashboard
      </Typography>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 800, mt: 0.5, mb: 1 }}>
        Welcome back, {greeting}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 560 }}>
        Quick access to Discover, matches, and messages. Use the logo anytime to return here.
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
          gap: 2,
        }}
      >
        {tiles.map((item) => (
          <Card key={item.to} variant="outlined" sx={cardSx}>
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
