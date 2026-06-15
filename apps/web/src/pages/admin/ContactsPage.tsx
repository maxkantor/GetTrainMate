import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  Tabs,
  Tab,
  Divider,
  Collapse,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { adminApiService } from '@/services/adminApiService';
import {
  normalizeContactDetail,
  normalizeEmailMessage,
  normalizeEmailThread,
  pickPagedItems,
} from '@/utils/adminApiNormalize';

interface ContactRow {
  contactId: string;
  name: string;
  email: string;
  phone?: string;
  status: string;
  tags?: string[];
  createdAt: string;
}

type ContactDetail = ReturnType<typeof normalizeContactDetail>;
type EmailThread = ReturnType<typeof normalizeEmailThread>;
type EmailMessage = ReturnType<typeof normalizeEmailMessage>;

function contactSubject(contact: ContactDetail): string {
  const topic = contact.tags.find((t) => t !== 'website');
  return topic ?? 'general';
}

export const ContactsPage: React.FC = () => {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [selectedContact, setSelectedContact] = useState<ContactDetail | null>(null);
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [threadMessages, setThreadMessages] = useState<Record<string, EmailMessage[]>>({});
  const [expandedThreadId, setExpandedThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [replyThreadId, setReplyThreadId] = useState<string | undefined>();

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApiService.get('/api/admin/contacts?page=1&pageSize=50');
      setContacts(pickPagedItems<ContactRow>(data));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const loadThreads = async (contactId: string) => {
    try {
      const data = await adminApiService.get(`/api/admin/contacts/${contactId}/threads`);
      const list = Array.isArray(data) ? data.map(normalizeEmailThread) : [];
      setThreads(list);
      setThreadMessages({});
      setExpandedThreadId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load threads');
    }
  };

  const loadThreadMessages = async (contactId: string, threadId: string) => {
    if (threadMessages[threadId]) return;
    try {
      const data = await adminApiService.get(
        `/api/admin/contacts/${contactId}/threads/${threadId}`,
      );
      const list = Array.isArray(data) ? data.map(normalizeEmailMessage) : [];
      setThreadMessages((prev) => ({ ...prev, [threadId]: list }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    }
  };

  const handleViewContact = async (contactId: string) => {
    try {
      const raw = await adminApiService.get(`/api/admin/contacts/${contactId}`);
      setSelectedContact(normalizeContactDetail(raw));
      setContactDialogOpen(true);
      setTabValue(0);
      await loadThreads(contactId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load contact');
    }
  };

  const toggleThread = async (threadId: string) => {
    if (!selectedContact) return;
    if (expandedThreadId === threadId) {
      setExpandedThreadId(null);
      return;
    }
    setExpandedThreadId(threadId);
    await loadThreadMessages(selectedContact.contactId, threadId);
  };

  const openReply = (thread?: EmailThread) => {
    if (!selectedContact) return;
    setReplyThreadId(thread?.threadId);
    setEmailSubject(
      thread?.subject?.startsWith('Re:')
        ? thread.subject
        : thread?.subject
          ? `Re: ${thread.subject}`
          : `Re: [GetTrainMate] Contact: ${contactSubject(selectedContact)}`,
    );
    setEmailBody('');
    setEmailDialogOpen(true);
  };

  const handleSendEmail = async () => {
    if (!selectedContact || !emailSubject || !emailBody) {
      setError('Subject and body are required');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await adminApiService.post(
        `/api/admin/contacts/${selectedContact.contactId}/email/reply`,
        {
          threadId: replyThreadId,
          to: selectedContact.email,
          subject: emailSubject,
          bodyText: emailBody,
          bodyHtml: `<p>${emailBody.replace(/\n/g, '<br>')}</p>`,
        },
      );
      setEmailDialogOpen(false);
      setEmailSubject('');
      setEmailBody('');
      setReplyThreadId(undefined);
      await loadThreads(selectedContact.contactId);
      if (replyThreadId) {
        setThreadMessages((prev) => {
          const next = { ...prev };
          delete next[replyThreadId];
          return next;
        });
        setExpandedThreadId(replyThreadId);
        await loadThreadMessages(selectedContact.contactId, replyThreadId);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Contacts CRM
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Tags</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">Loading...</TableCell>
              </TableRow>
            ) : contacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">No contacts found</TableCell>
              </TableRow>
            ) : (
              contacts.map((contact) => (
                <TableRow key={contact.contactId}>
                  <TableCell>{contact.name}</TableCell>
                  <TableCell>{contact.email}</TableCell>
                  <TableCell>{contact.phone || 'N/A'}</TableCell>
                  <TableCell>
                    <Chip
                      label={contact.status}
                      color={contact.status === 'active' ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {(contact.tags ?? []).map((tag) => (
                      <Chip key={tag} label={tag} size="small" sx={{ mr: 0.5 }} />
                    ))}
                  </TableCell>
                  <TableCell>{new Date(contact.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      onClick={() => handleViewContact(contact.contactId)}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={contactDialogOpen} onClose={() => setContactDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedContact?.name}
          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
            CRM v2
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
            <Tab label="Details" />
            <Tab label={`Email Threads (${threads.length})`} />
          </Tabs>

          {tabValue === 0 && selectedContact && (
            <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Typography><strong>Email:</strong> {selectedContact.email}</Typography>
              <Typography><strong>Phone:</strong> {selectedContact.phone || 'N/A'}</Typography>
              <Typography><strong>Status:</strong> {selectedContact.status}</Typography>
              <Typography><strong>Subject:</strong> {contactSubject(selectedContact)}</Typography>
              <Typography>
                <strong>Created:</strong>{' '}
                {new Date(selectedContact.createdAt).toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Contact ID:</strong> {selectedContact.contactId}
              </Typography>
              {selectedContact.tags.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  <Typography component="span" sx={{ mr: 1 }}><strong>Tags:</strong></Typography>
                  {selectedContact.tags.map((tag) => (
                    <Chip key={tag} label={tag} size="small" />
                  ))}
                </Box>
              )}
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2">Message</Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  bgcolor: 'action.hover',
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'inherit',
                }}
              >
                {selectedContact.notes?.trim() || 'No message on file.'}
              </Paper>
            </Box>
          )}

          {tabValue === 1 && selectedContact && (
            <Box sx={{ mt: 2 }}>
              <Button
                variant="contained"
                startIcon={<EmailIcon />}
                onClick={() => openReply(threads[0])}
                sx={{ mb: 2 }}
              >
                Send Email
              </Button>

              {threads.length === 0 ? (
                <Typography color="text.secondary">
                  No email threads yet.
                  {selectedContact.notes
                    ? ' The original website message is on the Details tab.'
                    : ''}
                </Typography>
              ) : (
                threads.map((thread) => {
                  const expanded = expandedThreadId === thread.threadId;
                  const messages = threadMessages[thread.threadId] ?? [];
                  return (
                    <Paper key={thread.threadId} variant="outlined" sx={{ mb: 2, overflow: 'hidden' }}>
                      <Box
                        sx={{
                          p: 2,
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: 1,
                          cursor: 'pointer',
                        }}
                        onClick={() => toggleThread(thread.threadId)}
                      >
                        <Box>
                          <Typography variant="subtitle1">{thread.subject}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {thread.messageCount} message{thread.messageCount === 1 ? '' : 's'}
                            {thread.lastFrom ? ` • Last from ${thread.lastFrom}` : ''}
                            {' • '}
                            {new Date(thread.lastMessageAt).toLocaleString()}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Button
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              openReply(thread);
                            }}
                          >
                            Reply
                          </Button>
                          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </Box>
                      </Box>
                      <Collapse in={expanded}>
                        <Divider />
                        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {messages.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">
                              Loading messages…
                            </Typography>
                          ) : (
                            messages.map((msg) => (
                              <Box
                                key={msg.messageId}
                                sx={{
                                  p: 1.5,
                                  borderRadius: 1,
                                  bgcolor: msg.direction === 'inbound' ? 'action.hover' : 'primary.dark',
                                  opacity: msg.direction === 'inbound' ? 1 : 0.9,
                                }}
                              >
                                <Typography variant="caption" color="text.secondary" display="block">
                                  {msg.direction === 'inbound' ? 'Inbound' : 'Outbound'}
                                  {' • '}
                                  {msg.from}
                                  {' • '}
                                  {new Date(msg.createdAt).toLocaleString()}
                                </Typography>
                                <Typography
                                  variant="body2"
                                  sx={{ mt: 1, whiteSpace: 'pre-wrap' }}
                                >
                                  {msg.bodyText || '(empty body)'}
                                </Typography>
                              </Box>
                            ))
                          )}
                        </Box>
                      </Collapse>
                    </Paper>
                  );
                })
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setContactDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={emailDialogOpen} onClose={() => setEmailDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Send Email to {selectedContact?.email}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Subject"
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            fullWidth
            multiline
            rows={10}
            label="Message"
            value={emailBody}
            onChange={(e) => setEmailBody(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSendEmail} variant="contained" disabled={!emailSubject || !emailBody}>
            Send
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
