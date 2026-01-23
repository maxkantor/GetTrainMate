import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Container,
  Drawer,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Toolbar,
  Typography,
  Snackbar,
  Alert as MUIAlert,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import PublishIcon from '@mui/icons-material/Publish';
import ArchiveIcon from '@mui/icons-material/Archive';
import RefreshIcon from '@mui/icons-material/Refresh';
import { cmsService, CMSContent, CreateContentRequest } from '@/services/cmsService';

const CONTENT_TYPES = ['landing_hero', 'feature', 'testimonial', 'faq', 'blog'];
const LANG_PRESETS = ['en', 'es', 'fr', 'de', 'it'];
const STATUSES = ['draft', 'published', 'archived'];

export const CMSPage: React.FC = () => {
  const [adminToken, setAdminToken] = useState<string>(() => localStorage.getItem('adminToken') || '');
  const [contentType, setContentType] = useState<string>('landing_hero');
  const [status, setStatus] = useState<string>('');

  const [items, setItems] = useState<CMSContent[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [snack, setSnack] = useState<{open: boolean; message: string; severity: 'success'|'error'|'info'}>({open: false, message: '', severity: 'success'});

  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [editing, setEditing] = useState<CMSContent | null>(null);
  const [query, setQuery] = useState<string>('');

  const initialForm: CreateContentRequest = useMemo(() => ({
    contentType: contentType,
    title: '',
    body: '',
    translations: {},
    status: 'draft',
  }), [contentType]);
  const [form, setForm] = useState<CreateContentRequest>(initialForm);

  useEffect(() => {
    setForm(initialForm);
  }, [initialForm]);

  const load = async () => {
    try {
      if (!adminToken) {
        setError('Provide admin token to load content');
        return;
      }
      setLoading(true);
      setError('');
      const data = await cmsService.listContent(adminToken, { contentType, status: status || undefined, limit: 200, q: query || undefined });
      setItems(data);
      setPage(0);
    } catch (e: any) {
      setError(e?.response?.data?.error || e.message || 'Failed to load content');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [contentType, status]);

  const saveToken = () => {
    localStorage.setItem('adminToken', adminToken);
  };

  const logout = () => {
    localStorage.removeItem('adminToken');
    setAdminToken('');
    window.location.href = '/admin/login';
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ contentType, title: '', body: '', translations: {}, status: 'draft' });
    setDrawerOpen(true);
  };

  const openEdit = (item: CMSContent) => {
    setEditing(item);
    setForm({
      contentType: item.contentType,
      title: item.title,
      body: item.body,
      translations: item.translations || {},
      status: item.status as any,
    });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!adminToken) return;
    try {
      setError('');
      if (editing) {
        const updated = await cmsService.updateContent(adminToken, editing.contentType, editing.contentId, form);
        setItems(items.map(i => (i.contentId === updated.contentId ? updated : i)));
      } else {
        const created = await cmsService.createContent(adminToken, form);
        setItems([created, ...items]);
      }
      setDrawerOpen(false);
      setSnack({open: true, message: 'Saved successfully', severity: 'success'});
    } catch (e: any) {
      setError(e?.response?.data?.error || e.message || 'Failed to save content');
      setSnack({open: true, message: 'Save failed', severity: 'error'});
    }
  };

  const publish = async (item: CMSContent) => {
    if (!adminToken) return;
    try {
      const updated = await cmsService.publishContent(adminToken, item.contentType, item.contentId);
      setItems(items.map(i => (i.contentId === updated.contentId ? updated : i)));
      setSnack({open: true, message: 'Published', severity: 'success'});
    } catch (e: any) {
      setError(e?.response?.data?.error || e.message || 'Failed to publish');
      setSnack({open: true, message: 'Publish failed', severity: 'error'});
    }
  };

  const archive = async (item: CMSContent) => {
    if (!adminToken) return;
    try {
      const updated = await cmsService.archiveContent(adminToken, item.contentType, item.contentId);
      setItems(items.map(i => (i.contentId === updated.contentId ? updated : i)));
      setSnack({open: true, message: 'Archived', severity: 'success'});
    } catch (e: any) {
      setError(e?.response?.data?.error || e.message || 'Failed to archive');
      setSnack({open: true, message: 'Archive failed', severity: 'error'});
    }
  };

  const translationPairs = Object.entries(form.translations || {});
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i => (i.title || '').toLowerCase().includes(q));
  }, [items, query]);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ mb: 2 }}>Admin CMS</Typography>

      <Toolbar disableGutters sx={{ gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          label="Admin Token"
          value={adminToken}
          onChange={(e) => setAdminToken(e.target.value)}
          size="small"
          sx={{ minWidth: 360 }}
        />
        <Button variant="outlined" onClick={saveToken}>Save Token</Button>
        <TextField
          select
          size="small"
          label="Content Type"
          value={contentType}
          onChange={(e) => setContentType(e.target.value)}
        >
          {CONTENT_TYPES.map(ct => <MenuItem key={ct} value={ct}>{ct}</MenuItem>)}
        </TextField>
        <TextField
          select
          size="small"
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <MenuItem value="">All</MenuItem>
          {STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>
        <TextField
          size="small"
          label="Search title"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(0); }}
          sx={{ minWidth: 220 }}
        />
        <Button startIcon={<RefreshIcon />} variant="outlined" onClick={load} disabled={loading}>Refresh</Button>
        <Button startIcon={<AddIcon />} variant="contained" onClick={openCreate}>New</Button>
        <Box flexGrow={1} />
        <Button color="error" variant="text" onClick={logout}>Logout</Button>
      </Toolbar>

      {error && (
        <Paper sx={{ p: 2, mb: 2, color: 'error.main', bgcolor: 'error.light', opacity: 0.9 }}>
          {error}
        </Paper>
      )}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Published</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredItems.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((item) => (
              <TableRow key={item.contentId} hover>
                <TableCell sx={{ cursor: 'pointer' }} onClick={() => openEdit(item)}>{item.title}</TableCell>
                <TableCell>{item.contentType}</TableCell>
                <TableCell>
                  <Chip label={item.status} color={item.status === 'published' ? 'success' : item.status === 'archived' ? 'default' : 'warning'} size="small" />
                </TableCell>
                <TableCell>{new Date(item.createdAt).toLocaleString()}</TableCell>
                <TableCell>{item.publishedAt ? new Date(item.publishedAt).toLocaleString() : '-'}</TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                     <Button size="small" variant="text" onClick={() => openEdit(item)}>Edit</Button>
                    <Button size="small" startIcon={<PublishIcon />} disabled={item.status === 'published'} onClick={() => publish(item)}>Publish</Button>
                    <Tooltip title="Soft delete: move to archived status">
                      <span>
                        <Button size="small" startIcon={<ArchiveIcon />} disabled={item.status === 'archived'} onClick={() => archive(item)}>Archive</Button>
                      </span>
                    </Tooltip>
                    <Tooltip title="Hard delete: permanently remove record">
                      <span>
                    <Button size="small" color="error" onClick={async () => {
                       if (!adminToken) return;
                       const ok = window.confirm('Permanently delete this content? This cannot be undone. Consider using Archive to retain a record.');
                       if (!ok) return;
                       try {
                         await cmsService.deleteContent(adminToken, item.contentType, item.contentId);
                         setItems(items.filter(i => i.contentId !== item.contentId));
                         setSnack({ open: true, message: 'Deleted', severity: 'success' });
                       } catch (e: any) {
                         setSnack({ open: true, message: 'Delete failed', severity: 'error' });
                       }
                     }}>Delete</Button>
                      </span>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={filteredItems.length}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[5,10,25,50]}
        />
      </TableContainer>

      <Snackbar
        open={snack.open}
        autoHideDuration={2500}
        onClose={() => setSnack({...snack, open: false})}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <MUIAlert severity={snack.severity} variant="filled" sx={{ width: '100%' }}>
          {snack.message}
        </MUIAlert>
      </Snackbar>

      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box sx={{ width: 440, p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6">{editing ? 'Edit Content' : 'New Content'}</Typography>
            <IconButton onClick={() => setDrawerOpen(false)}><CloseIcon /></IconButton>
          </Stack>

          <TextField
            select
            label="Content Type"
            fullWidth
            value={form.contentType}
            onChange={(e) => setForm({ ...form, contentType: e.target.value })}
            sx={{ mb: 2 }}
          >
            {CONTENT_TYPES.map(ct => <MenuItem key={ct} value={ct}>{ct}</MenuItem>)}
          </TextField>

          <TextField
            label="Title"
            fullWidth
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            sx={{ mb: 2 }}
          />

          <TextField
            label="Body"
            fullWidth
            multiline
            minRows={6}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            sx={{ mb: 2 }}
          />

          <Typography variant="subtitle2" sx={{ mb: 1 }}>Translations</Typography>
          <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
            {LANG_PRESETS.map(lang => (
              <Button key={lang} size="small" variant="outlined" onClick={() => {
                if (!form.translations) return setForm({ ...form, translations: { [lang]: '' } });
                if (form.translations[lang] !== undefined) return;
                setForm({ ...form, translations: { ...form.translations, [lang]: '' } });
              }}>
                Add {lang}
              </Button>
            ))}
          </Stack>
          <Stack spacing={1} sx={{ mb: 2 }}>
            {translationPairs.map(([lang, text], idx) => (
              <Stack key={lang} direction="row" spacing={1}>
                <TextField
                  label="Lang"
                  value={lang}
                  onChange={(e) => {
                    const newPairs = [...translationPairs];
                    newPairs[idx] = [e.target.value, text];
                    setForm({ ...form, translations: Object.fromEntries(newPairs) });
                  }}
                  sx={{ width: 100 }}
                />
                <TextField
                  label="Text"
                  value={text}
                  onChange={(e) => {
                    const newPairs = [...translationPairs];
                    newPairs[idx] = [lang, e.target.value];
                    setForm({ ...form, translations: Object.fromEntries(newPairs) });
                  }}
                  fullWidth
                />
                <Button color="error" onClick={() => {
                  const newPairs = translationPairs.filter((_, i) => i !== idx);
                  setForm({ ...form, translations: Object.fromEntries(newPairs) });
                }}>Remove</Button>
              </Stack>
            ))}
            <Button
              variant="outlined"
              onClick={() => {
                const newKey = '';
                setForm({ ...form, translations: { ...form.translations, [newKey]: '' } });
              }}
            >
              Add Translation
            </Button>
          </Stack>

          <TextField
            select
            label="Status"
            fullWidth
            value={form.status || 'draft'}
            onChange={(e) => setForm({ ...form, status: e.target.value as any })}
            sx={{ mb: 2 }}
          >
            {STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>

          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={handleSave}>Save</Button>
            <Button variant="text" onClick={() => setDrawerOpen(false)}>Cancel</Button>
          </Stack>
        </Box>
      </Drawer>
    </Container>
  );
};
