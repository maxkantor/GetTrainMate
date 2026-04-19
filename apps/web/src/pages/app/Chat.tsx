import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams, Link, useLocation } from 'react-router-dom';
import { Button, CircularProgress, Alert, Snackbar } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import LockIcon from '@mui/icons-material/Lock';
import { useI18n } from '@/hooks/useI18n';
import { formatI18n } from '@/i18n';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useMe } from '@/hooks/useMe';
import { chatService, ThreadPreviewResponse, ChatMessage } from '@/services/chatService';
import { authService } from '@/services/authService';
import {
  isGraphQLEnabled,
  graphqlGetThreadByMatch,
  graphqlListMessages,
  graphqlUnlockChat,
  graphqlCreateMessage,
  graphqlSubscribeMessages,
  graphqlListMyMatches,
} from '@/services/graphqlService';
import { handleApiError, isNetworkError } from '@/utils/apiErrorHandler';
import { getIcebreakers, getAiErrorMessage } from '@/services/aiService';
import { profileService } from '@/services/profileService';
import { IMAGE_BUCKET_BASE } from '@/config/media';
import { setChatUnreadTotal } from '@/utils/chatUnreadStore';
import { analytics, trackPremiumAction } from '@/utils/analytics';
import { useChatPresence } from '@/contexts/ChatPresenceContext';
import { CHAT_NAV_SCROLL_TOP_EVENT } from '@/utils/chatNav';
import { loadPremiumCatalog, PREMIUM_ACTION, creditPhrase } from '@/config/premiumCatalog';
import chatStyles from './Chat.module.css';

/** Keep a single row per peer when the API returns duplicate thread docs for the same pair. */
function dedupeThreadsByPeer(threads: ThreadPreviewResponse[]): ThreadPreviewResponse[] {
  const byPeer = new Map<string, ThreadPreviewResponse>();
  for (const t of threads) {
    const key = t.otherUserId || t.threadId;
    const prev = byPeer.get(key);
    if (!prev) {
      byPeer.set(key, t);
      continue;
    }
    const prevMs = Date.parse(prev.lastMessageAt || '') || 0;
    const curMs = Date.parse(t.lastMessageAt || '') || 0;
    byPeer.set(key, curMs >= prevMs ? t : prev);
  }
  return Array.from(byPeer.values()).sort((a, b) => {
    const am = Date.parse(a.lastMessageAt || '') || 0;
    const bm = Date.parse(b.lastMessageAt || '') || 0;
    return bm - am;
  });
}

function toAvatarUrl(avatarUrl: string | undefined): string | undefined {
  if (!avatarUrl || /randomuser\.me/i.test(avatarUrl)) return undefined;
  if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) return avatarUrl;
  return `${IMAGE_BUCKET_BASE}/${avatarUrl.replace(/^\//, '')}`;
}

export const ChatPage: React.FC = () => {
  const { t } = useI18n();
  const { user } = useAuthContext();
  const { me, refreshMe } = useMe();
  const { setActiveChatThreadId } = useChatPresence();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const threadIdFromUrl = searchParams.get('thread');

  const [threads, setThreads] = useState<ThreadPreviewResponse[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageContent, setMessageContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [threadLocked, setThreadLocked] = useState<boolean | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [otherName, setOtherName] = useState<string>('');
  const [otherAvatarUrl, setOtherAvatarUrl] = useState<string | undefined>(undefined);
  const [icebreakerSuggestions, setIcebreakerSuggestions] = useState<string[]>([]);
  const [icebreakerLoading, setIcebreakerLoading] = useState(false);
  const [icebreakerError, setIcebreakerError] = useState('');
  const [msgToast, setMsgToast] = useState<{ name: string } | null>(null);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [highlightedThreadId, setHighlightedThreadId] = useState<string | null>(null);
  const [unlockChatCost, setUnlockChatCost] = useState(1);
  const [icebreakerCost, setIcebreakerCost] = useState(1);
  /** Scroll only this pane — `scrollIntoView` on inner nodes scrolls the window and reveals the site footer. */
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const threadItemsRef = useRef<HTMLDivElement>(null);
  const chatTitleRef = useRef<HTMLHeadingElement>(null);
  const selectedThreadIdRef = useRef<string | null>(null);

  const scrollChatChromeToTop = useCallback((focusHeading: boolean) => {
    threadItemsRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    if (focusHeading) chatTitleRef.current?.focus({ preventScroll: true });
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, left: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onNavChat = () => {
      scrollChatChromeToTop(true);
      scrollToBottom();
    };
    window.addEventListener(CHAT_NAV_SCROLL_TOP_EVENT, onNavChat);
    return () => window.removeEventListener(CHAT_NAV_SCROLL_TOP_EVENT, onNavChat);
  }, [scrollChatChromeToTop, scrollToBottom]);

  useEffect(() => {
    if (location.pathname !== '/app/chat') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    scrollChatChromeToTop(false);
  }, [location.pathname, location.search, scrollChatChromeToTop]);

  useEffect(() => {
    selectedThreadIdRef.current = selectedThreadId;
  }, [selectedThreadId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const cat = await loadPremiumCatalog();
      if (cancelled) return;
      setUnlockChatCost(cat.costs[PREMIUM_ACTION.unlockChat] ?? 1);
      setIcebreakerCost(cat.costs[PREMIUM_ACTION.aiIcebreaker] ?? 1);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setActiveChatThreadId(selectedThreadId);
    return () => setActiveChatThreadId(null);
  }, [selectedThreadId, setActiveChatThreadId]);

  const threadIdsKey = useMemo(() => threads.map((t) => t.threadId).sort().join(','), [threads]);

  useEffect(() => {
    if (!isGraphQLEnabled || !user?.sub || threads.length === 0) return;
    const subs = threads.slice(0, 30).map((thread) =>
      graphqlSubscribeMessages(thread.threadId, (raw) => {
        const m = raw as {
          id?: string;
          threadId?: string;
          fromUserId?: string;
          body?: string;
          senderName?: string;
          createdAt?: string;
        };
        if (!m?.fromUserId || m.fromUserId === user.sub) return;
        const tid = m.threadId || thread.threadId;
        const viewing = tid === selectedThreadIdRef.current;

        setThreads((prev) => {
          const next = prev.map((t) => {
            if (t.threadId !== tid) return t;
            const inc = viewing ? 0 : 1;
            return {
              ...t,
              unreadCount: (t.unreadCount || 0) + inc,
              lastMessage: m.body ?? t.lastMessage,
            };
          });
          setChatUnreadTotal(next.reduce((s, t) => s + (t.unreadCount || 0), 0));
          return next;
        });

        if (viewing) {
          setMessages((prev) => {
            if (m.id && prev.some((x) => x.messageId === m.id)) return prev;
            return [
              ...prev,
              {
                messageId: m.id ?? `sub-${Date.now()}`,
                threadId: tid,
                senderId: m.fromUserId!,
                senderName: m.senderName ?? '',
                content: m.body ?? '',
                isRead: false,
                createdAt: m.createdAt ?? new Date().toISOString(),
              },
            ];
          });
          void (async () => {
            const token = await authService.getJWT();
            if (token) await chatService.markThreadAsRead(token, tid);
          })();
          return;
        }

        setMsgToast({ name: m.senderName?.trim() || 'Someone' });
        setHighlightedThreadId(tid);
      })
    );
    return () => subs.forEach((s) => s.unsubscribe());
  }, [isGraphQLEnabled, user?.sub, threadIdsKey]);

  useEffect(() => {
    if (threadIdFromUrl) setSelectedThreadId(threadIdFromUrl);
  }, [threadIdFromUrl]);

  useEffect(() => {
    if (!selectedThreadId || !user?.sub) {
      setThreadLocked(null);
      return;
    }
    let cancelled = false;
    setThreadLocked(null);
    void (async () => {
      try {
        if (isGraphQLEnabled) {
          const data = (await graphqlGetThreadByMatch(selectedThreadId)) as {
            unlockedByCurrentUser?: boolean;
            otherUserProfile?: { displayName?: string; avatarUrl?: string };
          } | null;
          if (cancelled) return;
          if (data) {
            setThreadLocked(!data.unlockedByCurrentUser);
            if (data.otherUserProfile?.displayName) setOtherName(data.otherUserProfile.displayName);
            setOtherAvatarUrl(toAvatarUrl(data.otherUserProfile?.avatarUrl));
          } else setThreadLocked(true);
        } else {
          const token = await authService.getJWT();
          if (!token || cancelled) return;
          const status = await chatService.getThreadByMatch(token, selectedThreadId);
          if (cancelled) return;
          setThreadLocked(!status.unlockedByCurrentUser);
        }
      } catch {
        if (!cancelled) setThreadLocked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedThreadId, user?.sub]);

  useEffect(() => {
    if (!selectedThreadId) return;
    loadMessages(selectedThreadId);
    if (threadLocked !== true) {
      markThreadAsRead(selectedThreadId);
    }
  }, [selectedThreadId, threadLocked]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const loadThreads = async () => {
    try {
      setLoading(true);
      setError('');
      if (isGraphQLEnabled) {
        const items = await graphqlListMyMatches() as { matchId: string; threadId: string; otherUserProfile?: { userId?: string; displayName?: string; avatarUrl?: string } }[];
        const data: ThreadPreviewResponse[] = dedupeThreadsByPeer(
          items.map((m) => ({
            threadId: m.threadId ?? m.matchId,
            otherUserId: m.otherUserProfile?.userId ?? '',
            otherUserName: m.otherUserProfile?.displayName ?? 'Unknown',
            otherUserAvatarUrl: toAvatarUrl(m.otherUserProfile?.avatarUrl),
            lastMessage: '',
            lastMessageAt: '',
            unreadCount: 0,
          }))
        );
        setThreads(data);
        setChatUnreadTotal(data.reduce((s, t) => s + (t.unreadCount || 0), 0));
        if (data.length > 0 && !selectedThreadId && !threadIdFromUrl) {
          setSelectedThreadId(data[0].threadId);
        }
        if (threadIdFromUrl) {
          const preview = data.find((t) => t.threadId === threadIdFromUrl);
          if (preview) setOtherName(preview.otherUserName);
        }
      } else {
        const token = await authService.getJWT();
        if (!token) {
          setError(t('app_messages.not_authenticated'));
          return;
        }
        const data = await chatService.getThreads(token);
        // Fetch profile photos for avatar images
        const withAvatars = dedupeThreadsByPeer(
          await Promise.all(
            data.map(async (t) => {
              if (!t.otherUserId) return t;
              try {
                const profile = await profileService.getProfile(token, t.otherUserId) as { photoUrls?: string[]; PhotoUrls?: string[] } | undefined;
                const urls = profile?.photoUrls ?? profile?.PhotoUrls ?? [];
                return { ...t, otherUserAvatarUrl: urls[0] };
              } catch {
                return t;
              }
            })
          )
        );
        setThreads(withAvatars);
        setChatUnreadTotal(withAvatars.reduce((s, t) => s + (t.unreadCount || 0), 0));
        if (withAvatars.length > 0 && !selectedThreadId && !threadIdFromUrl) {
          setSelectedThreadId(withAvatars[0].threadId);
        }
        if (threadIdFromUrl) {
          const preview = withAvatars.find((t) => t.threadId === threadIdFromUrl);
          if (preview) setOtherName(preview.otherUserName);
        }
      }
    } catch (err: unknown) {
      console.error('Error loading threads:', err);
      const apiError = handleApiError(err);
      if (isNetworkError(err) || apiError.isCorsError) {
        setError(t('app_messages.api_connect_error'));
      } else {
        setError(apiError.message || t('app_messages.failed_load_chats'));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.sub) {
      setThreads([]);
      setSelectedThreadId(null);
      setMessages([]);
      setLoading(false);
      setError('');
      return;
    }
    void loadThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload threads when signed-in user changes
  }, [user?.sub]);

  const handleUnlockChat = async () => {
    const matchId = selectedThreadId;
    if (!matchId || unlocking || (me?.credits ?? 0) < unlockChatCost) return;
    try {
      setUnlocking(true);
      setError('');
      if (isGraphQLEnabled) {
        await graphqlUnlockChat(matchId);
      } else {
        const token = await authService.getJWT();
        if (!token) return;
        await chatService.unlockChat(token, matchId);
      }
      await refreshMe();
      setActionToast('Chat unlocked');
      analytics.chatUnlocked(matchId);
      setThreadLocked(false);
      await loadThreads();
      setSelectedThreadId(matchId);
      await loadMessages(matchId);
    } catch (err: unknown) {
      const apiError = handleApiError(err);
      setError(apiError.message || t('app_messages.failed_unlock_chat'));
    } finally {
      setUnlocking(false);
    }
  };

  const dedupeMessages = (msgs: ChatMessage[]): ChatMessage[] => {
    const seen = new Set<string>();
    return msgs.filter((m) => {
      if (seen.has(m.messageId)) return false;
      seen.add(m.messageId);
      return true;
    });
  };

  const loadMessages = async (threadId: string) => {
    try {
      if (isGraphQLEnabled) {
        const result = await graphqlListMessages(threadId, 100);
        const items = (result.items || []) as { id: string; threadId: string; createdAt: string; fromUserId: string; body: string; senderName?: string }[];
        const data: ChatMessage[] = dedupeMessages(
          items.map((m) => ({
            messageId: m.id,
            threadId: m.threadId,
            senderId: m.fromUserId,
            senderName: m.senderName ?? '',
            content: m.body,
            isRead: false,
            createdAt: m.createdAt,
          }))
        );
        setMessages(data);
      } else {
        const token = await authService.getJWT();
        if (!token) return;
        const data = await chatService.getMessages(token, threadId, 100);
        setMessages(dedupeMessages(data));
      }
    } catch (err: any) {
      console.error('Error loading messages:', err);
    }
  };

  const markThreadAsRead = async (threadId: string) => {
    try {
      const token = await authService.getJWT();
      if (!token) return;

      await chatService.markThreadAsRead(token, threadId);

      setThreads((prev) => {
        const next = prev.map((t) => (t.threadId === threadId ? { ...t, unreadCount: 0 } : t));
        setChatUnreadTotal(next.reduce((s, t) => s + (t.unreadCount || 0), 0));
        return next;
      });
    } catch (err: any) {
      console.error('Error marking as read:', err);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedThreadId || !messageContent.trim()) return;

    try {
      setSending(true);
      if (isGraphQLEnabled) {
        const newMessage = await graphqlCreateMessage({
          matchId: selectedThreadId,
          body: messageContent.trim(),
        });
        setMessages((prev) => {
          if (prev.some((m) => m.messageId === newMessage.id)) return prev;
          return [
            ...prev,
            {
              messageId: newMessage.id,
              threadId: newMessage.threadId,
              senderId: newMessage.fromUserId,
              senderName: newMessage.senderName ?? '',
              content: newMessage.body,
              isRead: false,
              createdAt: newMessage.createdAt,
            },
          ];
        });
      } else {
        const token = await authService.getJWT();
        if (!token) return;
        const newMessage = await chatService.sendMessage(token, selectedThreadId, messageContent);
        setMessages((prev) => (prev.some((m) => m.messageId === newMessage.messageId) ? prev : [...prev, newMessage]));
      }
      setMessageContent('');
    } catch (err: any) {
      console.error('Error sending message:', err);
      const msg = err?.message || err?.errors?.[0]?.message || '';
      if (String(msg).includes('CHAT_LOCKED') || String(msg).includes('locked')) {
        setError(
          formatI18n(t('chat_ui.unlock_desc'), {
            cost: creditPhrase(unlockChatCost),
            credits: me?.credits ?? 0,
          })
        );
        setThreadLocked(true);
      } else {
        setError(t('app_messages.failed_send_message'));
      }
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className={chatStyles.root}>
        <div className={chatStyles.loading}>
          <CircularProgress sx={{ color: 'rgba(99, 102, 241, 0.8)' }} />
        </div>
      </div>
    );
  }

  if (!threadIdFromUrl && threads.length === 0) {
    return (
      <div className={chatStyles.root}>
        <div className={chatStyles.emptyState}>
          <p style={{ fontSize: 'var(--font-lg)', color: 'var(--color-neutral-300)', marginBottom: 'var(--space-4)' }}>
            {t('chat_ui.empty_state')}
          </p>
          <Button
            variant="contained"
            href="/app/discover"
            sx={{
              mt: 2,
              borderRadius: '24px',
              px: 3,
              py: 1.5,
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            {t('chat_ui.go_discover')}
          </Button>
        </div>
      </div>
    );
  }

  const selectedThread = threads.find(t => t.threadId === selectedThreadId);
  const displayName = selectedThread?.otherUserName || otherName || 'Chat';
  const headerAvatarUrl = selectedThread?.otherUserAvatarUrl ?? otherAvatarUrl;
  const avatarLetter = (name: string) => (name || '?').charAt(0).toUpperCase();

  const Avatar = ({ url, letter, className }: { url?: string; letter: string; className: string }) =>
    url ? (
      <img src={url} alt="" className={className} />
    ) : (
      <span className={className}>{letter}</span>
    );

  return (
    <div className={chatStyles.root}>
      <Snackbar
        open={!!msgToast}
        autoHideDuration={4500}
        onClose={() => setMsgToast(null)}
        message={msgToast ? formatI18n(t('chat_ui.new_message_from'), { name: msgToast.name }) : ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ bottom: { xs: 88, sm: 96 } }}
      />
      <Snackbar
        open={!!actionToast}
        autoHideDuration={3200}
        onClose={() => setActionToast(null)}
        message={actionToast ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ bottom: { xs: 88, sm: 96 } }}
      />
      <div className={chatStyles.layout}>
        {/* Thread List */}
        <aside className={chatStyles.threadList}>
          <h2 ref={chatTitleRef} className={chatStyles.threadListTitle} tabIndex={-1}>
            {t('nav.chat')}
          </h2>
          <div ref={threadItemsRef} className={chatStyles.threadItems}>
            {threads.map((thread) => (
              <button
                key={thread.threadId}
                type="button"
                className={`${chatStyles.threadItem} ${selectedThreadId === thread.threadId ? chatStyles.threadItemActive : ''} ${highlightedThreadId === thread.threadId ? chatStyles.threadItemHighlight : ''}`}
                onClick={() => {
                  setSelectedThreadId(thread.threadId);
                  if (highlightedThreadId === thread.threadId) setHighlightedThreadId(null);
                }}
              >
                <Avatar url={thread.otherUserAvatarUrl} letter={avatarLetter(thread.otherUserName)} className={chatStyles.threadAvatar} />
                <div className={chatStyles.threadMeta}>
                  <div className={chatStyles.threadName}>{thread.otherUserName}</div>
                  {thread.lastMessage && (
                    <div className={chatStyles.threadPreview}>{thread.lastMessage}</div>
                  )}
                </div>
                {thread.unreadCount > 0 && <span className={chatStyles.threadUnread} aria-label={`${thread.unreadCount} unread`} />}
              </button>
            ))}
          </div>
        </aside>

        {/* Messages */}
        <div className={chatStyles.messagesArea}>
          {selectedThreadId && (
            <>
              <div className={chatStyles.messagesHeader}>
                <Avatar url={headerAvatarUrl} letter={avatarLetter(displayName)} className={chatStyles.messagesHeaderAvatar} />
                {displayName}
              </div>

              {error && (
                <Alert severity="error" sx={{ mx: 2, mt: 2 }}>
                  {error}
                </Alert>
              )}

              {threadLocked === null ? (
                <div className={chatStyles.messagesLockWrap}>
                  <CircularProgress sx={{ color: 'rgba(99, 102, 241, 0.8)' }} />
                </div>
              ) : threadLocked === true ? (
                <div className={chatStyles.messagesLockWrap}>
                  <div className={chatStyles.lockedPanel}>
                    <div className={chatStyles.lockedIcon}>
                      <LockIcon sx={{ fontSize: 48, color: 'inherit' }} />
                    </div>
                    <h2 className={chatStyles.lockedTitle}>{t('chat_ui.unlock_title')}</h2>
                    <p className={chatStyles.lockedDesc}>
                      {formatI18n(t('chat_ui.unlock_desc'), {
                        cost: creditPhrase(unlockChatCost),
                        credits: me?.credits ?? 0,
                      })}
                    </p>
                    <button
                      type="button"
                      className={chatStyles.unlockBtn}
                      onClick={handleUnlockChat}
                      disabled={unlocking || (me?.credits ?? 0) < unlockChatCost}
                    >
                      <LockIcon sx={{ fontSize: 20 }} />
                      {unlocking
                        ? t('chat_ui.unlocking')
                        : formatI18n(t('chat_ui.unlock_cta'), { cost: creditPhrase(unlockChatCost) })}
                    </button>
                    <Link to="/pricing" className={chatStyles.upgradeLink}>
                      {t('header.get_credits')}
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  <div ref={messagesScrollRef} className={chatStyles.messagesScroll}>
                    {messages.map((msg) => (
                      <div
                        key={msg.messageId}
                        className={`${chatStyles.bubble} ${msg.senderId === user?.sub ? chatStyles.bubbleSent : chatStyles.bubbleReceived}`}
                      >
                        <span>{msg.content}</span>
                        <div className={chatStyles.bubbleTime}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className={chatStyles.aiToolsRow}>
                    <button
                      type="button"
                      className={chatStyles.aiIcebreakerBtn}
                      onClick={async () => {
                        const thread = threads.find((t) => t.threadId === selectedThreadId);
                        const token = await authService.getJWT();
                        if (!token || !thread || !selectedThreadId) return;
                        if ((me?.credits ?? 0) < icebreakerCost) {
                          const short = icebreakerCost - (me?.credits ?? 0);
                          setIcebreakerError(
                            short === 1
                              ? t('credits.need_more_credits_one')
                              : formatI18n(t('credits.need_more_credits_many'), { need: short })
                          );
                          return;
                        }
                        setIcebreakerError('');
                        setIcebreakerLoading(true);
                        setIcebreakerSuggestions([]);
                        try {
                          const myProfile = me?.profile;
                          let otherBio: string | undefined;
                          let otherSports: string[] = [];
                          let otherLevel: string | undefined;
                          let otherGoals: string[] = [];
                          if (thread.otherUserId) {
                            try {
                              const other = await profileService.getProfile(token, thread.otherUserId);
                              otherBio = other.bio;
                              otherSports = other.sportTags ?? [];
                              otherLevel = other.level;
                              otherGoals = other.goals ?? [];
                            } catch {
                              /* use name only */
                            }
                          }
                          const res = await getIcebreakers(token, {
                            threadId: selectedThreadId,
                            myName: myProfile?.name ?? 'Me',
                            myBio: myProfile?.bio,
                            mySports: myProfile?.sportTags ?? [],
                            myLevel: myProfile?.level,
                            myGoals: myProfile?.goals ?? [],
                            otherName: thread.otherUserName,
                            otherBio,
                            otherSports,
                            otherLevel,
                            otherGoals,
                          });
                          setIcebreakerSuggestions(res.suggestions ?? []);
                          if (res.suggestions?.length) {
                            await refreshMe();
                            trackPremiumAction('ai_icebreaker', 'success');
                          }
                        } catch (err) {
                          setIcebreakerError(getAiErrorMessage(err));
                        } finally {
                          setIcebreakerLoading(false);
                        }
                      }}
                      disabled={icebreakerLoading}
                      title={formatI18n(t('chat_ui.ai_icebreaker_cta'), { cost: creditPhrase(icebreakerCost) })}
                    >
                      {icebreakerLoading
                        ? t('chat_ui.generating')
                        : formatI18n(t('chat_ui.ai_icebreaker_cta'), { cost: creditPhrase(icebreakerCost) })}
                    </button>
                    <Link to="/app/ai-coach" className={chatStyles.askAiLink}>
                      {t('chat_ui.ask_ai')}
                    </Link>
                  </div>
                  {icebreakerError && (
                    <Alert severity="error" onClose={() => setIcebreakerError('')} sx={{ mx: 2, mb: 1 }}>
                      {icebreakerError}
                    </Alert>
                  )}
                  {icebreakerSuggestions.length > 0 && (
                    <div className={chatStyles.icebreakerChips}>
                      {icebreakerSuggestions.map((s, i) => (
                        <button
                          key={i}
                          type="button"
                          className={chatStyles.icebreakerChip}
                          onClick={() => {
                            setMessageContent(s);
                            setIcebreakerSuggestions([]);
                          }}
                        >
                          {s.length > 50 ? s.slice(0, 47) + '…' : s}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className={chatStyles.inputRow}>
                    <textarea
                      className={chatStyles.input}
                      placeholder="Type a message..."
                      value={messageContent}
                      onChange={(e) => setMessageContent(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      disabled={sending}
                      rows={2}
                    />
                    <button
                      type="button"
                      className={chatStyles.sendBtn}
                      onClick={handleSendMessage}
                      disabled={sending || !messageContent.trim()}
                    >
                      <SendIcon sx={{ fontSize: 20 }} />
                      Send
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
