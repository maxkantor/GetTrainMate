import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { adminApiService } from '@/services/adminApiService';

type Prospect = {
  prospectId: string;
  organizationName: string;
  organizationType: string;
  email: string;
  emailSource: string;
  metro: string;
  activity: string;
  partnerCode?: string;
  landingUrl?: string;
  status: string;
  website?: string;
  sourceUrl?: string;
};

type QueueItem = {
  queueId: string;
  organizationName: string;
  recipient: string;
  subject: string;
  bodyText: string;
  status: string;
  partnerUrl: string;
};

const TABS = [
  'prospect',
  'draft',
  'approved',
  'queued',
  'sent',
  'replied',
  'opted_out',
  'bounced',
  'complained',
];

export const PartnerOutreachPage: React.FC = () => {
  const [tab, setTab] = useState(0);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState({
    organizationName: '',
    organizationType: 'run_club',
    email: '',
    emailSource: 'public_listing',
    website: '',
    sourceUrl: '',
    partnerCode: '',
    landingUrl: '',
    activity: 'training',
  });
  const [approveItem, setApproveItem] = useState<QueueItem | null>(null);

  const load = async () => {
    setError(null);
    try {
      const [p, q, m] = await Promise.all([
        adminApiService.get('/api/admin/partner-outreach/prospects'),
        adminApiService.get('/api/admin/partner-outreach/queue'),
        adminApiService.get('/api/admin/partner-outreach/metrics'),
      ]);
      setProspects(Array.isArray(p) ? p : p?.items ?? []);
      setQueue(Array.isArray(q) ? q : q?.items ?? []);
      setMetrics(m);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const status = TABS[tab];
  const shownProspects = prospects.filter((p) =>
    status === 'prospect' ? p.status === 'prospect' || p.status === 'draft' || true : p.status === status
  );
  const shownQueue = queue.filter((q) => (status === 'prospect' ? true : q.status === status || (status === 'draft' && q.status === 'draft')));

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Partner Outreach
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Sending stays disabled until PARTNER_OUTREACH_SEND_ENABLED=true, postal address is set, and you approve each
        recipient. From: Max from GetTrainMate &lt;partners@gettrainmate.com&gt;. Daily cap 3. No Gmail / noreply.
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {metrics && (
        <Alert severity="info" sx={{ mb: 2 }}>
          sendEnabled={String(metrics.sendEnabled)} approved={String(metrics.approvedRecipients)} sent=
          {String(metrics.sent)} delivered={String(metrics.delivered)} replies={String(metrics.replies)} complaints=
          {String(metrics.complaints)} pause={String(metrics.complaintPause)}
        </Alert>
      )}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" sx={{ mb: 2 }}>
        {TABS.map((t) => (
          <Tab key={t} label={t.replace('_', ' ')} />
        ))}
      </Tabs>

      <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', mb: 2 }}>
        <TextField size="small" label="Organization" value={form.organizationName} onChange={(e) => setForm({ ...form, organizationName: e.target.value })} />
        <TextField size="small" label="Public business email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <TextField size="small" label="Email source" value={form.emailSource} onChange={(e) => setForm({ ...form, emailSource: e.target.value })} helperText="public_listing | owner_supplied | prior_engagement" />
        <TextField size="small" label="Website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
        <TextField size="small" label="Source URL" value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} />
        <TextField size="small" label="Partner code" value={form.partnerCode} onChange={(e) => setForm({ ...form, partnerCode: e.target.value })} />
        <TextField size="small" label="Landing URL" value={form.landingUrl} onChange={(e) => setForm({ ...form, landingUrl: e.target.value })} />
      </Box>
      <Button
        variant="contained"
        onClick={async () => {
          await adminApiService.post('/api/admin/partner-outreach/prospects', {
            ...form,
            metro: 'Atlanta',
          });
          await load();
        }}
      >
        Add prospect
      </Button>

      <Typography variant="h6" sx={{ mt: 3 }}>
        Prospects
      </Typography>
      {shownProspects.map((p) => (
        <Box key={p.prospectId} sx={{ py: 1, borderBottom: '1px solid #eee' }}>
          <Typography>
            {p.organizationName} — {p.email} <Chip size="small" label={p.status} sx={{ ml: 1 }} />
          </Typography>
          <Button
            size="small"
            onClick={async () => {
              await adminApiService.post('/api/admin/partner-outreach/drafts', { prospectId: p.prospectId });
              await load();
            }}
          >
            Prepare draft
          </Button>
        </Box>
      ))}

      <Typography variant="h6" sx={{ mt: 3 }}>
        Queue
      </Typography>
      {shownQueue.map((q) => (
        <Box key={q.queueId} sx={{ py: 1, borderBottom: '1px solid #eee' }}>
          <Typography>
            {q.organizationName} → {q.recipient} <Chip size="small" label={q.status} />
          </Typography>
          <Typography variant="body2">{q.subject}</Typography>
          {q.status === 'draft' && (
            <Button size="small" onClick={() => setApproveItem(q)}>
              Review &amp; approve
            </Button>
          )}
        </Box>
      ))}

      <Dialog open={!!approveItem} onClose={() => setApproveItem(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Approve this recipient only</DialogTitle>
        <DialogContent>
          {approveItem && (
            <>
              <Typography sx={{ mb: 1 }}>
                {approveItem.organizationName} / {approveItem.recipient}
              </Typography>
              <Typography variant="subtitle2">{approveItem.subject}</Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>
                {approveItem.bodyText}
              </Typography>
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                {approveItem.partnerUrl}
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveItem(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={async () => {
              if (!approveItem) return;
              await adminApiService.post(`/api/admin/partner-outreach/queue/${approveItem.queueId}/approve`, {
                confirm: true,
              });
              setApproveItem(null);
              await load();
            }}
          >
            Approve this message
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
