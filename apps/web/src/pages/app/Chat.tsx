import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  TextField,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  Grid,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import LockIcon from '@mui/icons-material/Lock';
import { useI18n } from '@/hooks/useI18n';
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
import chatStyles from './Chat.module.css';

export const ChatPage: React.FC = () => {
  const { t } = useI18n();
  const { user } = useAuthContext();
  const { me, refreshMe } = useMe();
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadThreads();
  }, []);

  useEffect(() => {
    if (threadIdFromUrl) {
      const checkLock = async () => {
        if (isGraphQLEnabled) {
          try {
            const data = await graphqlGetThreadByMatch(threadIdFromUrl) as { unlockedByCurrentUser?: boolean; otherUserProfile?: { displayName?: string } } | null;
            if (data) {
              setThreadLocked(!data.unlockedByCurrentUser);
              if (data.otherUserProfile?.displayName) setOtherName(data.otherUserProfile.displayName);
            } else setThreadLocked(true);
            setSelectedThreadId(threadIdFromUrl);
          } catch {
            setThreadLocked(true);
            setSelectedThreadId(threadIdFromUrl);
          }
        } else {
          const token = await authService.getJWT();
          if (!token) return;
          try {
            const status = await chatService.getThreadByMatch(token, threadIdFromUrl);
            setThreadLocked(!status.unlockedByCurrentUser);
            setSelectedThreadId(threadIdFromUrl);
            const threadPreview = threads.find((t) => t.threadId === threadIdFromUrl);
            if (threadPreview) setOtherName(threadPreview.otherUserName);
          } catch {
            setThreadLocked(true);
            setSelectedThreadId(threadIdFromUrl);
          }
        }
      };
      checkLock();
    } else {
      setThreadLocked(null);
    }
  }, [threadIdFromUrl, threads.length]);

  useEffect(() => {
    if (selectedThreadId && threadLocked !== true) {
      loadMessages(selectedThreadId);
      markThreadAsRead(selectedThreadId);
    }
  }, [selectedThreadId, threadLocked]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadThreads = async () => {
    try {
      setLoading(true);
      setError('');
      if (isGraphQLEnabled) {
        const items = await graphqlListMyMatches() as { matchId: string; threadId: string; otherUserProfile?: { displayName?: string } }[];
        const data: ThreadPreviewResponse[] = items.map((m) => ({
          threadId: m.threadId ?? m.matchId,
          otherUserId: '',
          otherUserName: m.otherUserProfile?.displayName ?? 'Unknown',
          lastMessage: '',
          lastMessageAt: '',
          unreadCount: 0,
        }));
        setThreads(data);
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
          setError('Not authenticated');
          return;
        }
        const data = await chatService.getThreads(token);
        setThreads(data);
        if (data.length > 0 && !selectedThreadId && !threadIdFromUrl) {
          setSelectedThreadId(data[0].threadId);
        }
        if (threadIdFromUrl) {
          const preview = data.find((t) => t.threadId === threadIdFromUrl);
          if (preview) setOtherName(preview.otherUserName);
        }
      }
    } catch (err: unknown) {
      console.error('Error loading threads:', err);
      const apiError = handleApiError(err);
      if (isNetworkError(err) || apiError.isCorsError) {
        setError('Unable to connect to the API. Please check your connection and try again.');
      } else {
        setError(apiError.message || 'Failed to load chats');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUnlockChat = async () => {
    if (!threadIdFromUrl || unlocking || (me?.credits ?? 0) < 1) return;
    try {
      setUnlocking(true);
      setError('');
      if (isGraphQLEnabled) {
        await graphqlUnlockChat(threadIdFromUrl);
      } else {
        const token = await authService.getJWT();
        if (!token) return;
        await chatService.unlockChat(token, threadIdFromUrl);
      }
      await refreshMe();
      setThreadLocked(false);
      await loadThreads();
      setSelectedThreadId(threadIdFromUrl);
      await loadMessages(threadIdFromUrl);
    } catch (err: unknown) {
      const apiError = handleApiError(err);
      setError(apiError.message || 'Failed to unlock chat');
    } finally {
      setUnlocking(false);
    }
  };

  const loadMessages = async (threadId: string) => {
    try {
      if (isGraphQLEnabled) {
        const result = await graphqlListMessages(threadId, 100);
        const items = (result.items || []) as { id: string; threadId: string; createdAt: string; fromUserId: string; body: string; senderName?: string }[];
        const data: ChatMessage[] = items.map((m) => ({
          messageId: m.id,
          threadId: m.threadId,
          senderId: m.fromUserId,
          senderName: m.senderName ?? '',
          content: m.body,
          isRead: false,
          createdAt: m.createdAt,
        }));
        setMessages(data);
      } else {
        const token = await authService.getJWT();
        if (!token) return;
        const data = await chatService.getMessages(token, threadId, 100);
        setMessages(data);
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
      
      // Update thread unread count
      setThreads(threads.map(t => 
        t.threadId === threadId ? { ...t, unreadCount: 0 } : t
      ));
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
        setMessages((prev) => [
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
        ]);
      } else {
        const token = await authService.getJWT();
        if (!token) return;
        const newMessage = await chatService.sendMessage(token, selectedThreadId, messageContent);
        setMessages([...messages, newMessage]);
      }
      setMessageContent('');
    } catch (err: any) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <Container sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (!threadIdFromUrl && threads.length === 0) {
    return (
      <Container sx={{ py: 6 }}>
        <Alert severity="info" sx={{ mb: 2 }}>
          No chats yet. Like someone on Discover — when you both like each other, you match. Unlock chat (1 credit) to message.
        </Alert>
        <Button variant="outlined" size="small" href="/app/discover" sx={{ mt: 2 }}>
          Go to Discover
        </Button>
      </Container>
    );
  }

  if (threadIdFromUrl && threadLocked === true) {
    const credits = me?.credits ?? 0;
    return (
      <div className={chatStyles.container}>
        <div className={chatStyles.lockedPanel}>
          <div className={chatStyles.lockedIcon}>
            <LockIcon sx={{ fontSize: 48, color: 'inherit' }} />
          </div>
          <h2 className={chatStyles.lockedTitle}>Chat locked</h2>
          <p className={chatStyles.lockedDesc}>
            Unlock this chat to send messages (1 credit). Your credits: {credits}
          </p>
          <button
            type="button"
            className={chatStyles.unlockBtn}
            onClick={handleUnlockChat}
            disabled={unlocking || credits < 1}
          >
            <LockIcon sx={{ fontSize: 20 }} />
            {unlocking ? 'Unlocking…' : 'Unlock chat (1 credit)'}
          </button>
          <Link to="/pricing" className={chatStyles.upgradeLink}>
            Get more credits →
          </Link>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </div>
      </div>
    );
  }

  const selectedThread = threads.find(t => t.threadId === selectedThreadId);
  const displayName = selectedThread?.otherUserName || otherName || 'Chat';

  return (
    <Container maxWidth="lg" sx={{ py: 2, height: '85vh', display: 'flex', flexDirection: 'column' }}>
      <Grid container spacing={2} sx={{ height: '100%', overflow: 'hidden' }}>
        {/* Thread List - hide on small when opening from match */}
        <Grid item xs={12} sm={4} sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Typography variant="h6" sx={{ pb: 1 }}>
            {t('nav.chat')}
          </Typography>
          <Paper sx={{ flex: 1, overflow: 'auto' }}>
            <List sx={{ p: 0 }}>
              {threads.map((thread) => (
                <Box key={thread.threadId}>
                  <ListItemButton
                    selected={selectedThreadId === thread.threadId}
                    onClick={() => setSelectedThreadId(thread.threadId)}
                  >
                    <ListItemText
                      primary={thread.otherUserName}
                      secondary={thread.lastMessage}
                      secondaryTypographyProps={{ noWrap: true }}
                    />
                    {thread.unreadCount > 0 && (
                      <Chip
                        label={thread.unreadCount}
                        size="small"
                        color="primary"
                        variant="filled"
                      />
                    )}
                  </ListItemButton>
                  <Divider />
                </Box>
              ))}
            </List>
          </Paper>
        </Grid>

        {/* Messages */}
        <Grid item xs={12} sm={8} sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {selectedThreadId && (
            <>
              <Box sx={{ pb: 1, borderBottom: '1px solid #eee' }}>
                <Typography variant="h6">{displayName}</Typography>
              </Box>

              {error && (
                <Alert severity="error" sx={{ mb: 1 }}>
                  {error}
                </Alert>
              )}

              <Paper
                sx={{
                  flex: 1,
                  overflow: 'auto',
                  p: 2,
                  mb: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                }}
              >
                {messages.map((msg) => (
                  <Box
                    key={msg.messageId}
                    sx={{
                      display: 'flex',
                      justifyContent: msg.senderId === user?.sub ? 'flex-end' : 'flex-start',
                      mb: 1,
                    }}
                  >
                    <Paper
                      sx={{
                        p: 1.5,
                        maxWidth: '70%',
                        backgroundColor:
                          msg.senderId === user?.sub ? '#1976d2' : '#e0e0e0',
                        color: msg.senderId === user?.sub ? 'white' : 'black',
                      }}
                    >
                      <Typography variant="body2">{msg.content}</Typography>
                      <Typography variant="caption" sx={{ opacity: 0.7 }}>
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </Typography>
                    </Paper>
                  </Box>
                ))}
                <div ref={messagesEndRef} />
              </Paper>

              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Type a message..."
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={sending}
                  multiline
                  maxRows={3}
                />
                <Button
                  variant="contained"
                  color="primary"
                  endIcon={<SendIcon />}
                  onClick={handleSendMessage}
                  disabled={sending || !messageContent.trim()}
                >
                  Send
                </Button>
              </Box>
            </>
          )}
        </Grid>
      </Grid>
    </Container>
  );
};
