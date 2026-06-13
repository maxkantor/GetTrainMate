import React, { useMemo } from 'react';
import { Link as RouterLink, matchPath, useLocation } from 'react-router-dom';
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined';
import FavoriteBorderOutlinedIcon from '@mui/icons-material/FavoriteBorderOutlined';
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import { useI18n } from '@/hooks/useI18n';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useChatUnreadCount } from '@/hooks/useChatUnreadCount';
import { useWorldCupHubNav } from '@/hooks/useWorldCupHubNav';
import { requestChatNavScrollTop } from '@/utils/chatNav';
import styles from './AppBottomNav.module.css';

type Tab = {
  href: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
  badge?: number;
  onClick?: () => void;
};

export const AppBottomNav: React.FC = () => {
  const { t } = useI18n();
  const { user } = useAuthContext();
  const { pathname } = useLocation();
  const chatUnread = useChatUnreadCount();
  const { showNav: showWorldCupNav, hubRoute } = useWorldCupHubNav();

  const tabs: Tab[] = useMemo(() => {
    const items: Tab[] = [
      {
        href: '/app/discover',
        label: t('nav.discover'),
        icon: <ExploreOutlinedIcon className={styles.icon} />,
        exact: true,
      },
      {
        href: '/app/matches',
        label: t('nav.match'),
        icon: <FavoriteBorderOutlinedIcon className={styles.icon} />,
      },
      {
        href: '/app/chat',
        label: t('nav.chat'),
        icon: <ChatBubbleOutlineOutlinedIcon className={styles.icon} />,
        badge: chatUnread > 0 ? chatUnread : undefined,
        onClick: () => requestChatNavScrollTop(),
      },
    ];

    if (showWorldCupNav) {
      items.push({
        href: hubRoute,
        label: t('nav.bottom_hub'),
        icon: <span className={styles.icon} aria-hidden>⚽</span>,
        exact: true,
      });
    } else {
      items.push({
        href: '/app/profile',
        label: t('nav.profile'),
        icon: <PersonOutlineOutlinedIcon className={styles.icon} />,
      });
    }

    return items;
  }, [t, chatUnread, showWorldCupNav, hubRoute]);

  if (!user) return null;

  return (
    <nav className={styles.root} aria-label={t('nav.bottom_bar')}>
      <div className={styles.inner}>
        {tabs.map((tab) => {
          const active = matchPath({ path: tab.href, end: tab.exact ?? false }, pathname);
          return (
            <RouterLink
              key={tab.href}
              to={tab.href}
              className={`${styles.tab} ${active ? styles.tabActive : ''}`}
              onClick={tab.onClick}
            >
              <span className={styles.iconWrap}>
                {tab.icon}
                {tab.badge != null && tab.badge > 0 ? (
                  <span className={styles.badge}>{tab.badge > 99 ? '99+' : tab.badge}</span>
                ) : null}
              </span>
              <span className={styles.label}>{tab.label}</span>
            </RouterLink>
          );
        })}
      </div>
    </nav>
  );
};
