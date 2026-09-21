import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Divider,
  Drawer,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import type { PanelSharedProps, PartnerCampaign, PartnerProspect, PartnerQueueItem, ProspectFilters } from './types';
import {
  API,
  EmptyState,
  PanelSkeleton,
  StatusChip,
  asArray,
  formatCents,
  formatDate,
  hasEmail,
  marketLabel,
  parseTimeline,
  previewText,
  prospectScore,
  queueForProspect,
} from './components';
import { adminApiService } from '@/services/adminApiService';

interface Props extends PanelSharedProps {
  initialFilters?: ProspectFilters;
}

export const ProspectsPanel: React.FC<Props> = ({
  onError,
  onNotice,
  refreshKey,
  requestRefresh,
  initialFilters,
}) => {
  const [prospects, setProspects] = useState<PartnerProspect[]>([]);
  const [queue, setQueue] = useState<PartnerQueueItem[]>([]);
  const [campaigns, setCampaigns] = useState<PartnerCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PartnerProspect | null>(null);
  const [filters, setFilters] = useState<ProspectFilters>({
    contactAvailable: 'any',
    ...initialFilters,
  });
  const [searchInput, setSearchInput] = useState(initialFilters?.search || '');

  useEffect(() => {
    if (initialFilters) {
      setFilters((prev) => ({ ...prev, ...initialFilters }));
      if (initialFilters.search != null) setSearchInput(initialFilters.search);
    }
  }, [initialFilters]);

  const load = useCallback(async () => {
    setLoading(true);
    onError(null);
    try {
      const [p, q, c] = await Promise.all([
        adminApiService.get(`${API}/prospects`),
        adminApiService.get(`${API}/queue`),
        adminApiService.get(`${API}/campaigns`),
      ]);
      setProspects(asArray<PartnerProspect>(p));
      setQueue(asArray<PartnerQueueItem>(q));
      setCampaigns(asArray<PartnerCampaign>(c));
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Failed to load prospects');
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const campaignMap = useMemo(() => {
    const m = new Map<string, PartnerCampaign>();
    for (const c of campaigns) m.set(c.campaignId, c);
    return m;
  }, [campaigns]);

  const markets = useMemo(() => {
    const set = new Set<string>();
    for (const p of prospects) {
      const m = p.metro || p.city;
      if (m) set.add(m);
    }
    return [...set].sort();
  }, [prospects]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of prospects) {
      if (p.organizationType) set.add(p.organizationType);
      if (p.activity) set.add(p.activity);
    }
    return [...set].sort();
  }, [prospects]);

  const filtered = useMemo(() => {
    return prospects.filter((p) => {
      if (filters.market) {
        const m = (p.metro || p.city || '').toLowerCase();
        if (m !== filters.market.toLowerCase()) return false;
      }
      if (filters.category) {
        const cat = (p.organizationType || p.activity || '').toLowerCase();
        if (cat !== filters.category.toLowerCase()) return false;
      }
      if (filters.prospectType && filters.prospectType !== 'any') {
        const t = (p.prospectType || 'organization').toLowerCase();
        if (t !== filters.prospectType.toLowerCase()) return false;
      }
      if (filters.scoreMin != null && filters.scoreMin > 0) {
        if (prospectScore(p) < filters.scoreMin) return false;
      }
      if (filters.contactAvailable === 'available' && !hasEmail(p)) return false;
      if (filters.contactAvailable === 'needed') {
        const needed =
          p.contactState === 'CONTACT_NEEDED' ||
          p.status === 'no_verified_public_email' ||
          !hasEmail(p);
        if (!needed) return false;
      }
      if (filters.lifecycle) {
        const life = (p.crmLifecycle || '').toUpperCase();
        if (life !== filters.lifecycle.toUpperCase()) return false;
      }
      if (filters.contactState) {
        if ((p.contactState || '').toUpperCase() !== filters.contactState.toUpperCase()) return false;
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const hay = [p.organizationName, p.email, p.contactName, p.metro, p.city, p.website]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [prospects, filters]);

  const applySearch = () => setFilters((f) => ({ ...f, search: searchInput.trim() }));

  const act = async (label: string, fn: () => Promise<unknown>) => {
    onError(null);
    try {
      await fn();
      onNotice(label);
      requestRefresh();
      await load();
      if (selected) {
        const refreshed = asArray<PartnerProspect>(await adminApiService.get(`${API}/prospects`));
        const next = refreshed.find((x) => x.prospectId === selected.prospectId) || null;
        setSelected(next);
      }
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Action failed');
    }
  };

  if (loading && prospects.length === 0) return <PanelSkeleton rows={8} />;

  const drawerQueue = selected ? queueForProspect(queue, selected.prospectId) : [];
  const timeline = selected ? parseTimeline(selected.timelineJson) : [];

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }} useFlexGap flexWrap="wrap">
        <TextField
          size="small"
          label="Search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applySearch()}
          sx={{ minWidth: 200 }}
        />
        <Button variant="outlined" onClick={applySearch}>
          Search
        </Button>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Market</InputLabel>
          <Select
            label="Market"
            value={filters.market || ''}
            onChange={(e) => setFilters((f) => ({ ...f, market: e.target.value || undefined }))}
          >
            <MenuItem value="">All</MenuItem>
            {markets.map((m) => (
              <MenuItem key={m} value={m}>
                {m}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Category</InputLabel>
          <Select
            label="Category"
            value={filters.category || ''}
            onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value || undefined }))}
          >
            <MenuItem value="">All</MenuItem>
            {categories.map((c) => (
              <MenuItem key={c} value={c}>
                {c}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Type</InputLabel>
          <Select
            label="Type"
            value={filters.prospectType || 'any'}
            onChange={(e) => setFilters((f) => ({ ...f, prospectType: e.target.value }))}
          >
            <MenuItem value="any">Any</MenuItem>
            <MenuItem value="organization">Organization</MenuItem>
            <MenuItem value="individual">Individual</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Contact</InputLabel>
          <Select
            label="Contact"
            value={filters.contactAvailable || 'any'}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                contactAvailable: e.target.value as ProspectFilters['contactAvailable'],
              }))
            }
          >
            <MenuItem value="any">Any</MenuItem>
            <MenuItem value="available">Available</MenuItem>
            <MenuItem value="needed">Needed</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Lifecycle</InputLabel>
          <Select
            label="Lifecycle"
            value={filters.lifecycle || ''}
            onChange={(e) => setFilters((f) => ({ ...f, lifecycle: e.target.value || undefined }))}
          >
            <MenuItem value="">All</MenuItem>
            {['NEW', 'QUALIFIED', 'CONTACTED', 'FOLLOW_UP', 'REPLIED', 'INTERESTED', 'PARTNER', 'CLOSED'].map((l) => (
              <MenuItem key={l} value={l}>
                {l}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          size="small"
          type="number"
          label="Score min"
          value={filters.scoreMin ?? ''}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              scoreMin: e.target.value === '' ? undefined : Number(e.target.value),
            }))
          }
          sx={{ width: 110 }}
        />
      </Stack>

      {filtered.length === 0 ? (
        <EmptyState title="No prospects match" detail="Adjust filters or run discovery from Acquisition." />
      ) : (
        <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, maxHeight: '70vh' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                {[
                  'Organization / Person',
                  'Type',
                  'Market',
                  'Category',
                  'Website',
                  'Contact',
                  'Email',
                  'Verification',
                  'Score',
                  'Lifecycle',
                  'Campaign',
                  'Last Contact',
                  'Next Action',
                  'Referral Users',
                  'Customers',
                  'Revenue',
                  'Actions',
                ].map((h) => (
                  <TableCell key={h} sx={{ whiteSpace: 'nowrap', fontWeight: 700 }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((p) => {
                const camp = p.campaignId ? campaignMap.get(p.campaignId) : undefined;
                const qItems = queueForProspect(queue, p.prospectId);
                const next =
                  qItems.find((q) => q.status === 'draft')
                    ? 'Approve draft'
                    : qItems.find((q) => q.status === 'scheduled')
                      ? 'Follow-up due'
                      : !hasEmail(p)
                        ? 'Find contact'
                        : p.crmLifecycle === 'REPLIED'
                          ? 'Reply'
                          : 'Review';
                return (
                  <TableRow
                    key={p.prospectId}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => setSelected(p)}
                  >
                    <TableCell>
                      <Typography sx={{ fontWeight: 600 }}>{p.organizationName || '—'}</Typography>
                      {p.contactName && (
                        <Typography variant="caption" color="text.secondary">
                          {p.contactName}
                          {p.contactRole ? ` · ${p.contactRole}` : ''}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{p.prospectType || 'organization'}</TableCell>
                    <TableCell>{marketLabel(p)}</TableCell>
                    <TableCell>{p.organizationType || p.activity || '—'}</TableCell>
                    <TableCell>
                      {p.website ? (
                        <Button
                          size="small"
                          href={p.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Open
                        </Button>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>{p.contactName || '—'}</TableCell>
                    <TableCell sx={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.email || '—'}
                    </TableCell>
                    <TableCell>
                      <StatusChip label={p.emailVerificationStatus || (hasEmail(p) ? 'email' : 'needed')} />
                    </TableCell>
                    <TableCell>{prospectScore(p)}</TableCell>
                    <TableCell>
                      <StatusChip label={p.crmLifecycle || p.status || '—'} color="info" />
                    </TableCell>
                    <TableCell>{camp?.displayName || camp?.name || p.campaignId || '—'}</TableCell>
                    <TableCell>{formatDate(p.lastContactedAt)}</TableCell>
                    <TableCell>{next}</TableCell>
                    <TableCell>{p.referralSignups ?? 0}</TableCell>
                    <TableCell>{p.paidCustomers ?? 0}</TableCell>
                    <TableCell>{formatCents(p.attributedRevenueCents)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button size="small" onClick={() => setSelected(p)}>
                        Open
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Drawer anchor="right" open={!!selected} onClose={() => setSelected(null)} PaperProps={{ sx: { width: { xs: '100%', sm: 440 } } }}>
        {selected && (
          <Box sx={{ p: 2.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              {selected.organizationName}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {marketLabel(selected)} · {selected.prospectType || 'organization'}
            </Typography>

            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Identity
            </Typography>
            <Typography variant="body2">Email: {selected.email || '—'}</Typography>
            <Typography variant="body2">Contact: {selected.contactName || '—'} {selected.contactRole ? `(${selected.contactRole})` : ''}</Typography>
            <Typography variant="body2">Website: {selected.website || '—'}</Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Verification: {selected.emailVerificationStatus || '—'} · Contact state: {selected.contactState || '—'}
            </Typography>

            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Score
            </Typography>
            <Typography variant="body2">Acquisition: {selected.acquisitionScore ?? '—'} · Fit: {selected.fitScore ?? '—'}</Typography>
            <Typography variant="body2">Audience {selected.audienceFitScore ?? '—'} · Market {selected.marketRelevanceScore ?? '—'} · Community {selected.communityFitScore ?? '—'} · Contact {selected.contactQualityScore ?? '—'}</Typography>
            {selected.scoreExplanation && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5, mb: 2 }}>
                {selected.scoreExplanation}
              </Typography>
            )}

            <Divider sx={{ my: 1.5 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Outreach queue
            </Typography>
            {drawerQueue.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                No queue items
              </Typography>
            ) : (
              drawerQueue.map((q) => (
                <Box key={q.queueId} sx={{ mb: 1.25, p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <StatusChip label={q.status} />
                  <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>
                    {q.subject}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {previewText(q.bodyText, 100)}
                  </Typography>
                </Box>
              ))
            )}

            {timeline.length > 0 && (
              <>
                <Divider sx={{ my: 1.5 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  Timeline
                </Typography>
                {timeline.map((ev, i) => (
                  <Typography key={i} variant="caption" display="block" color="text.secondary">
                    {ev.at ? formatDate(ev.at) : '—'} — {ev.label || ev.type || ev.note || 'event'}
                  </Typography>
                ))}
              </>
            )}

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 3 }}>
              <Button
                variant="contained"
                size="small"
                disabled={!hasEmail(selected)}
                onClick={() =>
                  void act('Draft prepared', () =>
                    adminApiService.post(`${API}/drafts`, {
                      prospectId: selected.prospectId,
                      campaignId: selected.campaignId,
                    }),
                  )
                }
              >
                Prepare draft
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() =>
                  void act('Marked interested', () =>
                    adminApiService.post(`${API}/prospects/${encodeURIComponent(selected.prospectId)}/interested`, {}),
                  )
                }
              >
                Mark interested
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() =>
                  void act('Converted to partner', () =>
                    adminApiService.post(`${API}/prospects/${encodeURIComponent(selected.prospectId)}/convert-partner`, {}),
                  )
                }
              >
                Convert partner
              </Button>
              {selected.website && (
                <Button size="small" href={selected.website} target="_blank" rel="noopener noreferrer">
                  Open website
                </Button>
              )}
            </Stack>
          </Box>
        )}
      </Drawer>
    </Box>
  );
};
