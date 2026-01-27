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
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import { adminApiService } from '@/services/adminApiService';

interface Contact {
  contactId: string;
  name: string;
  email: string;
  phone?: string;
  status: string;
  tags: string[];
  createdAt: string;
}

interface EmailThread {
  threadId: string;
  subject: string;
  lastMessageAt: string;
  messageCount: number;
  status: string;
}

export const ContactsPage: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApiService.get('/api/admin/contacts?page=1&pageSize=50');
      setContacts(data.items || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const loadThreads = async (contactId: string) => {
    try {
      const data = await adminApiService.get(`/api/admin/contacts/${contactId}/threads`);
      setThreads(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load threads');
    }
  };

  const handleViewContact = async (contactId: string) => {
    try {
      const contact = await adminApiService.get(`/api/admin/contacts/${contactId}`);
      setSelectedContact(contact);
      setContactDialogOpen(true);
      await loadThreads(contactId);
    } catch (err: any) {
      setError(err.message || 'Failed to load contact');
    }
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
          to: selectedContact.email,
          subject: emailSubject,
          bodyText: emailBody,
          bodyHtml: `<p>${emailBody.replace(/\n/g, '<br>')}</p>`,
        }
      );
      setEmailDialogOpen(false);
      setEmailSubject('');
      setEmailBody('');
      await loadThreads(selectedContact.contactId);
    } catch (err: any) {
      setError(err.message || 'Failed to send email');
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
                    {contact.tags.map((tag) => (
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
        <DialogTitle>{selectedContact?.name}</DialogTitle>
        <DialogContent>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
            <Tab label="Details" />
            <Tab label="Email Threads" />
          </Tabs>
          {tabValue === 0 && selectedContact && (
            <Box sx={{ mt: 2 }}>
              <Typography><strong>Email:</strong> {selectedContact.email}</Typography>
              <Typography><strong>Phone:</strong> {selectedContact.phone || 'N/A'}</Typography>
              <Typography><strong>Status:</strong> {selectedContact.status}</Typography>
            </Box>
          )}
          {tabValue === 1 && (
            <Box sx={{ mt: 2 }}>
              <Button
                variant="contained"
                startIcon={<EmailIcon />}
                onClick={() => setEmailDialogOpen(true)}
                sx={{ mb: 2 }}
              >
                Send Email
              </Button>
              {threads.map((thread) => (
                <Box key={thread.threadId} sx={{ mb: 2, p: 2, border: '1px solid #ddd', borderRadius: 1 }}>
                  <Typography variant="subtitle1">{thread.subject}</Typography>
                  <Typography variant="body2" color="textSecondary">
                    {thread.messageCount} messages • Last: {new Date(thread.lastMessageAt).toLocaleString()}
                  </Typography>
                </Box>
              ))}
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
