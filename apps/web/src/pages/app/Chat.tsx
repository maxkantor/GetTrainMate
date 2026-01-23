import React, { useState, useEffect, useRef } from 'react';
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
import { useI18n } from '@/hooks/useI18n';
import { useAuthContext } from '@/hooks/useAuthContext';
import { chatService, ThreadPreviewResponse, ChatMessage } from '@/services/chatService';
import { authService } from '@/services/authService';

export const ChatPage: React.FC = () => {
  const { t } = useI18n();
  const { user } = useAuthContext();

  const [threads, setThreads] = useState<ThreadPreviewResponse[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageContent, setMessageContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadThreads();
  }, []);

  useEffect(() => {
    if (selectedThreadId) {
      loadMessages(selectedThreadId);
      markThreadAsRead(selectedThreadId);
    }
  }, [selectedThreadId]);

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
      const token = await authService.getJWT();
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const data = await chatService.getThreads(token);
      setThreads(data);
      if (data.length > 0 && !selectedThreadId) {
        setSelectedThreadId(data[0].threadId);
      }
    } catch (err: any) {
      console.error('Error loading threads:', err);
      setError(err.message || 'Failed to load chats');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (threadId: string) => {
    try {
      const token = await authService.getJWT();
      if (!token) return;

      const data = await chatService.getMessages(token, threadId, 100);
      setMessages(data);
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
      const token = await authService.getJWT();
      if (!token) return;

      const newMessage = await chatService.sendMessage(token, selectedThreadId, messageContent);
      setMessages([...messages, newMessage]);
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

  if (threads.length === 0) {
    return (
      <Container sx={{ py: 8 }}>
        <Alert severity="info">No chats yet. Start by liking someone on the discovery page!</Alert>
      </Container>
    );
  }

  const selectedThread = threads.find(t => t.threadId === selectedThreadId);

  return (
    <Container maxWidth="lg" sx={{ py: 2, height: '85vh', display: 'flex', flexDirection: 'column' }}>
      <Grid container spacing={2} sx={{ height: '100%', overflow: 'hidden' }}>
        {/* Thread List */}
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
          {selectedThread && (
            <>
              <Box sx={{ pb: 1, borderBottom: '1px solid #eee' }}>
                <Typography variant="h6">{selectedThread.otherUserName}</Typography>
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
