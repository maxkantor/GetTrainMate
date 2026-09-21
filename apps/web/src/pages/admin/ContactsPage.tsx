import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  Stack,
  Pagination,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SearchIcon from '@mui/icons-material/Search';
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
  likelySpam?: boolean;
}

type ContactDetail = ReturnType<typeof normalizeContactDetail>;
type EmailThread = ReturnType<typeof normalizeEmailThread>;
type EmailMessage = ReturnType<typeof normalizeEmailMessage>;
type SpamFilter = 'all' | 'spam' | 'clean';

function contactSubject(contact: ContactDetail): string {
  const topic = contact.tags.find((t) => t !== 'website');
  return topic ?? 'general';
}

function pickTotalCount(data: unknown): number {
  if (!data || typeof data !== 'object') return 0;
  const o = data as Record<string, unknown>;
  const n = o.totalCount ?? o.TotalCount;
  return typeof n === 'number' ? n : Number(n) || 0;
}

function pickTotalPages(data: unknown): number {
  if (!data || typeof data !== 'object') return 1;
  const o = data as Record<string, unknown>;
  const n = o.totalPages ?? o.TotalPages;
  return Math.max(1, typeof n === 'number' ? n : Number(n) || 1);
}

export const ContactsPage: React.FC = () => {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [selectedContact, setSelectedContact] = useState<ContactDetail | null>(null);
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [threadMessages, setThreadMessages] = useState<Record<string, EmailMessage[]>>({});
  const [expandedThreadId, setExpandedThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ContactRow | null>(null);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [replyThreadId, setReplyThreadId] = useState<string | undefined>();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [tag, setTag] = useState('');
  const [spamFilter, setSpamFilter] = useState<SpamFilter>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const pageSize = 50;

  const loadContacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (search.trim()) params.set('search', search.trim());
      if (status) params.set('status', status);
      if (tag.trim()) params.set('tag', tag.trim());
      if (spamFilter === 'spam') params.set('spamLikely', 'true');
      if (spamFilter === 'clean') params.set('spamLikely', 'false');

      const data = await adminApiService.get(`/api/admin/contacts?${params.toString()}`);
      const items = pickPagedItems<ContactRow & { LikelySpam?: boolean }>(data).map((c) => ({
        ...c,
        likelySpam: Boolean(c.likelySpam ?? c.LikelySpam),
      }));
      setContacts(items);
      setTotalCount(pickTotalCount(data));
      setTotalPages(pickTotalPages(data));
      setSelectedIds(new Set());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, [page, search, status, tag, spamFilter]);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  const applyFilters = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  const allVisibleSelected =
    contacts.length > 0 && contacts.every((c) => selectedIds.has(c.contactId));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(contacts.map((c) => c.contactId)));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectLikelySpamOnPage = () => {
    setSelectedIds(new Set(contacts.filter((c) => c.likelySpam).map((c) => c.contactId)));
  };

  const spamOnPage = useMemo(() => contacts.filter((c) => c.likelySpam).length, [contacts]);

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

  const confirmDeleteOne = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await adminApiService.delete(`/api/admin/contacts/${deleteTarget.contactId}`);
      setSuccess(`Deleted ${deleteTarget.name || deleteTarget.email}`);
      setDeleteTarget(null);
      if (selectedContact?.contactId === deleteTarget.contactId) {
        setContactDialogOpen(false);
        setSelectedContact(null);
      }
      await loadContacts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete contact');
    } finally {
      setDeleting(false);
    }
  };

  const confirmBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await adminApiService.post('/api/admin/contacts/bulk-delete', {
        contactIds: ids,
      });
      const deleted = (res as { deleted?: number })?.deleted ?? ids.length;
      setSuccess(`Deleted ${deleted} contact${deleted === 1 ? '' : 's'}`);
      setBulkConfirmOpen(false);
      setSelectedIds(new Set());
      await loadContacts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to bulk delete');
    } finally {
      setDeleting(false);
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
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Search, filter spam, and soft-delete contacts. Deletion is admin-only and audited.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          alignItems={{ md: 'center' }}
          flexWrap="wrap"
          useFlexGap
        >
          <TextField
            size="small"
            label="Search name, email, notes"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyFilters();
            }}
            sx={{ minWidth: { xs: '100%', md: 260 }, flex: 1 }}
          />
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Status</InputLabel>
            <Select
              label="Status"
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value);
              }}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="blocked">Blocked</MenuItem>
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="Tag"
            placeholder="e.g. website"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyFilters();
            }}
            sx={{ minWidth: 120 }}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Spam filter</InputLabel>
            <Select
              label="Spam filter"
              value={spamFilter}
              onChange={(e) => {
                setPage(1);
                setSpamFilter(e.target.value as SpamFilter);
              }}
            >
              <MenuItem value="all">All contacts</MenuItem>
              <MenuItem value="spam">Likely spam</MenuItem>
              <MenuItem value="clean">Not flagged</MenuItem>
            </Select>
          </FormControl>
          <Button variant="contained" startIcon={<SearchIcon />} onClick={applyFilters}>
            Apply
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              setSearchInput('');
              setSearch('');
              setStatus('');
              setTag('');
              setSpamFilter('all');
              setPage(1);
            }}
          >
            Clear
          </Button>
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.5 }} alignItems="center">
          <Typography variant="body2" color="text.secondary">
            {totalCount} contact{totalCount === 1 ? '' : 's'}
            {spamOnPage > 0 ? ` · ${spamOnPage} likely spam on this page` : ''}
            {someSelected ? ` · ${selectedIds.size} selected` : ''}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Button size="small" disabled={spamOnPage === 0} onClick={selectLikelySpamOnPage}>
            Select likely spam on page
          </Button>
          <Button
            size="small"
            color="error"
            variant="contained"
            startIcon={<DeleteOutlineIcon />}
            disabled={!someSelected}
            onClick={() => setBulkConfirmOpen(true)}
          >
            Delete selected
          </Button>
        </Stack>
      </Paper>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={allVisibleSelected}
                  indeterminate={someSelected && !allVisibleSelected}
                  onChange={toggleSelectAll}
                  inputProps={{ 'aria-label': 'Select all contacts on page' }}
                />
              </TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Tags</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : contacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  No contacts found
                </TableCell>
              </TableRow>
            ) : (
              contacts.map((contact) => (
                <TableRow
                  key={contact.contactId}
                  hover
                  selected={selectedIds.has(contact.contactId)}
                  sx={contact.likelySpam ? { bgcolor: 'rgba(244, 67, 54, 0.06)' } : undefined}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedIds.has(contact.contactId)}
                      onChange={() => toggleSelect(contact.contactId)}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                      {contact.name}
                      {contact.likelySpam ? (
                        <Chip label="likely spam" size="small" color="warning" />
                      ) : null}
                    </Box>
                  </TableCell>
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
                    {(contact.tags ?? []).map((t) => (
                      <Chip key={t} label={t} size="small" sx={{ mr: 0.5 }} />
                    ))}
                  </TableCell>
                  <TableCell>{new Date(contact.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => handleViewContact(contact.contactId)}>
                      View
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      onClick={() => setDeleteTarget(contact)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, p) => setPage(p)}
            color="primary"
          />
        </Box>
      )}

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
              <Typography>
                <strong>Email:</strong> {selectedContact.email}
              </Typography>
              <Typography>
                <strong>Phone:</strong> {selectedContact.phone || 'N/A'}
              </Typography>
              <Typography>
                <strong>Status:</strong> {selectedContact.status}
              </Typography>
              <Typography>
                <strong>Subject:</strong> {contactSubject(selectedContact)}
              </Typography>
              <Typography>
                <strong>Created:</strong> {new Date(selectedContact.createdAt).toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Contact ID:</strong> {selectedContact.contactId}
              </Typography>
              {selectedContact.tags.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  <Typography component="span" sx={{ mr: 1 }}>
                    <strong>Tags:</strong>
                  </Typography>
                  {selectedContact.tags.map((t) => (
                    <Chip key={t} label={t} size="small" />
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
                                  bgcolor:
                                    msg.direction === 'inbound' ? 'action.hover' : 'primary.dark',
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
                                <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
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
          <Button
            color="error"
            onClick={() => {
              if (!selectedContact) return;
              setDeleteTarget({
                contactId: selectedContact.contactId,
                name: selectedContact.name,
                email: selectedContact.email,
                status: selectedContact.status,
                tags: selectedContact.tags,
                createdAt: selectedContact.createdAt,
              });
            }}
          >
            Delete contact
          </Button>
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
          <Button
            onClick={handleSendEmail}
            variant="contained"
            disabled={!emailSubject || !emailBody}
          >
            Send
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)}>
        <DialogTitle>Delete contact?</DialogTitle>
        <DialogContent>
          <Typography>
            Soft-delete <strong>{deleteTarget?.name}</strong> ({deleteTarget?.email}). They will
            disappear from Contacts CRM but remain in the audit log.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={() => void confirmDeleteOne()} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={bulkConfirmOpen} onClose={() => !deleting && setBulkConfirmOpen(false)}>
        <DialogTitle>Delete {selectedIds.size} contacts?</DialogTitle>
        <DialogContent>
          <Typography>
            Soft-delete the selected contacts. This cannot be undone from the CRM UI.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkConfirmOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => void confirmBulkDelete()}
            disabled={deleting}
          >
            {deleting ? 'Deleting…' : `Delete ${selectedIds.size}`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
