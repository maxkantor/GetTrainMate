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
  MenuItem,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { adminApiService } from '@/services/adminApiService';
import {
  INITIAL_MARKET_CANDIDATES,
  MAX_ACTIVE_MARKETS,
  partnerInvitePath,
  slugPart,
} from '@/data/markets';

type Prospect = {
  prospectId: string;
  organizationName: string;
  organizationType: string;
  email: string;
  emailSource: string;
  metro: string;
  city?: string;
  country?: string;
  campaignLanguage?: string;
  mode?: string;
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

type Campaign = {
  campaignId: string;
  displayName?: string;
  name?: string;
  country: string;
  market: string;
  status: string;
  primaryMode?: string;
  languages?: string[];
};

const TABS = [
  'prospect',
  'discovered',
  'no_verified_public_email',
  'qualified_language_unavailable',
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
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Record<string, unknown> | null>(null);
  const [discoverySummary, setDiscoverySummary] = useState<Record<string, unknown> | null>(null);
  const [discoverNote, setDiscoverNote] = useState<string | null>(null);
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
    country: 'us',
    city: '',
    campaignLanguage: 'en',
    mode: 'TRAIN',
  });
  const [approveItem, setApproveItem] = useState<QueueItem | null>(null);

  const load = async () => {
    setError(null);
    try {
      const [p, q, m, c, d] = await Promise.all([
        adminApiService.get('/api/admin/partner-outreach/prospects'),
        adminApiService.get('/api/admin/partner-outreach/queue'),
        adminApiService.get('/api/admin/partner-outreach/metrics'),
        adminApiService.get('/api/admin/partner-outreach/campaigns'),
        adminApiService.get('/api/admin/partner-outreach/discovery/summary'),
      ]);
      setProspects(Array.isArray(p) ? p : p?.items ?? []);
      setQueue(Array.isArray(q) ? q : q?.items ?? []);
      setMetrics(m);
      setDiscoverySummary(d);
      setCampaigns(Array.isArray(c) ? c : c?.items ?? INITIAL_MARKET_CANDIDATES);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const status = TABS[tab];
  const shownProspects = prospects.filter((p) => {
    if (status === 'prospect') return p.status === 'prospect' || p.status === 'draft';
    if (status === 'discovered') return p.status === 'discovered';
    if (status === 'no_verified_public_email') return p.status === 'no_verified_public_email';
    if (status === 'qualified_language_unavailable') return p.status === 'qualified_language_unavailable';
    return p.status === status;
  });
  const shownQueue = queue.filter((q) =>
    status === 'prospect' || status === 'discovered' ? true : q.status === status || (status === 'draft' && q.status === 'draft')
  );

  const runAutomatedDiscovery = async () => {
    setError(null);
    setDiscoverNote(null);
    try {
      const res = await adminApiService.post('/api/admin/partner-outreach/discover/automated', {
        prepareDrafts: true,
        maxPerMarket: 40,
      });
      setDiscoverNote(
        `Automated discovery complete. Created: ${res?.organizationsDiscovered ?? 0}. Qualified: ${res?.qualifiedOrganizations ?? 0}. Verified contacts: ${res?.verifiedPublicContacts ?? 0}. Drafts: ${res?.draftsGenerated ?? 0}. Approval-ready: ${res?.approvalReadyRecipients ?? 0}. No verified email: ${res?.contactsUnavailable ?? 0}.`
      );
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Automated discovery failed');
    }
  };

  const setStatus = async (campaignId: string, next: string) => {
    setError(null);
    try {
      await adminApiService.post(`/api/admin/partner-outreach/campaigns/${encodeURIComponent(campaignId)}/status`, {
        status: next,
      });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not update campaign');
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Partner Outreach
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        International TRAIN partner campaigns. Max {MAX_ACTIVE_MARKETS} active markets. Primary workflow: automated
        discovery → website resolution → public contact verification → CRM → dedupe → scoring → invite code → landing URL
        → personalized draft → approval queue. Never infer emails. Sending stays disabled until PARTNER_OUTREACH_SEND_ENABLED=true,
        postal address is set, and you approve each recipient.
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {metrics && (
        <Alert severity="info" sx={{ mb: 2 }}>
          sendEnabled={String(metrics.sendEnabled)} approved={String(metrics.approvedRecipients)} sent=
          {String(metrics.sent)} delivered={String(metrics.delivered)} replies={String(metrics.replies)} complaints=
          {String(metrics.complaints)} pause={String(metrics.complaintPause)} maxActive=
          {String(metrics.maxActiveMarkets ?? MAX_ACTIVE_MARKETS)}
        </Alert>
      )}
      {discoverySummary && (
        <Alert severity="info" sx={{ mb: 2 }}>
          discovered={String(discoverySummary.organizationsDiscovered)} qualified=
          {String(discoverySummary.qualifiedOrganizations)} verifiedContacts=
          {String(discoverySummary.verifiedPublicContacts)} noEmail={String(discoverySummary.contactsUnavailable)}{' '}
          drafts={String(discoverySummary.draftsGenerated)} approvalReady=
          {String(discoverySummary.approvalReadyRecipients)}
        </Alert>
      )}
      {discoverNote && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setDiscoverNote(null)}>
          {discoverNote}
        </Alert>
      )}

      <Typography variant="h6" sx={{ mb: 1 }}>
        Market campaigns
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        <Button variant="contained" size="small" onClick={() => void runAutomatedDiscovery()}>
          Run automated discovery (all ranked markets)
        </Button>
      </Box>
      <Box sx={{ display: 'grid', gap: 1, mb: 3 }}>
        {(campaigns.length ? campaigns : INITIAL_MARKET_CANDIDATES).map((c) => (
          <Box
            key={c.campaignId}
            sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', py: 1, borderBottom: '1px solid #eee' }}
          >
            <Typography sx={{ minWidth: 220, fontWeight: 600 }}>{c.displayName || c.campaignId}</Typography>
            <Chip size="small" label={c.status} />
            <Chip size="small" variant="outlined" label={`${c.country}/${c.market}`} />
            <Chip size="small" variant="outlined" label={c.primaryMode || 'TRAIN'} />
            <Button size="small" onClick={() => void runAutomatedDiscovery()}>
              Run automated discovery
            </Button>
            {c.status !== 'active' && (
              <Button size="small" onClick={() => void setStatus(c.campaignId, 'active')}>
                Activate
              </Button>
            )}
            {c.status === 'active' && (
              <Button size="small" onClick={() => void setStatus(c.campaignId, 'paused')}>
                Pause
              </Button>
            )}
            {c.status === 'paused' && (
              <Button size="small" onClick={() => void setStatus(c.campaignId, 'candidate')}>
                Demote
              </Button>
            )}
          </Box>
        ))}
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" sx={{ mb: 2 }}>
        {TABS.map((t) => (
          <Tab key={t} label={t.replace('_', ' ')} />
        ))}
      </Tabs>

      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Optional manual override (not primary workflow)
      </Typography>
      <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', mb: 2 }}>
        <TextField size="small" label="Organization" value={form.organizationName} onChange={(e) => setForm({ ...form, organizationName: e.target.value })} />
        <TextField size="small" label="Public business email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} helperText="Only if already verified on an org-controlled page. Leave blank — automation verifies contacts." />
        <TextField size="small" select label="Email source" value={form.emailSource} onChange={(e) => setForm({ ...form, emailSource: e.target.value })}>
          <MenuItem value="public_listing">public_listing</MenuItem>
          <MenuItem value="owner_supplied">owner_supplied</MenuItem>
          <MenuItem value="prior_engagement">prior_engagement</MenuItem>
        </TextField>
        <TextField size="small" label="Country (ISO)" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
        <TextField size="small" label="City / metro" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        <TextField size="small" select label="Campaign language" value={form.campaignLanguage} onChange={(e) => setForm({ ...form, campaignLanguage: e.target.value })} helperText="Approved human-reviewed templates: en, es, ru.">
          <MenuItem value="en">en (approved)</MenuItem>
          <MenuItem value="es">es (approved)</MenuItem>
          <MenuItem value="ru">ru (approved)</MenuItem>
        </TextField>
        <TextField size="small" select label="Mode" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
          <MenuItem value="TRAIN">TRAIN</MenuItem>
          <MenuItem value="VIBE">VIBE (app mode; not this campaign)</MenuItem>
          <MenuItem value="DATE">DATE (app mode; not this campaign)</MenuItem>
        </TextField>
        <TextField size="small" label="Website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
        <TextField size="small" label="Source URL" value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} />
        <TextField size="small" label="Partner code" value={form.partnerCode} onChange={(e) => setForm({ ...form, partnerCode: e.target.value })} />
        <TextField size="small" label="Landing URL" value={form.landingUrl} onChange={(e) => setForm({ ...form, landingUrl: e.target.value })} />
      </Box>
      <Button
        variant="contained"
        onClick={async () => {
          setError(null);
          try {
            const landing =
              form.landingUrl ||
              (form.partnerCode
                ? `https://gettrainmate.com${partnerInvitePath(form.country, slugPart(form.city) || 'market', form.partnerCode)}`
                : '');
            await adminApiService.post('/api/admin/partner-outreach/prospects', {
              ...form,
              metro: form.city,
              landingUrl: landing,
            });
            await load();
          } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Could not add prospect');
          }
        }}
      >
        Add prospect (override)
      </Button>

      <Typography variant="h6" sx={{ mt: 3 }}>
        Prospects
      </Typography>
      {shownProspects.map((p) => (
        <Box key={p.prospectId} sx={{ py: 1, borderBottom: '1px solid #eee' }}>
          <Typography>
            {p.organizationName} — {p.email || '(no email yet)'}{' '}
            <Chip size="small" label={p.status} sx={{ ml: 1 }} />
            <Chip size="small" variant="outlined" label={`${p.country || '?'}/${p.metro || p.city || '?'}`} sx={{ ml: 1 }} />
          </Typography>
          <Button
            size="small"
            disabled={!p.email}
            onClick={async () => {
              setError(null);
              try {
                await adminApiService.post('/api/admin/partner-outreach/drafts', { prospectId: p.prospectId });
                await load();
              } catch (e: unknown) {
                setError(e instanceof Error ? e.message : 'Could not prepare draft');
              }
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
