import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
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
import type { PanelSharedProps, PartnerProspect, PartnerQueueItem, ProspectFilters } from './types';
import {
  API,
  EmptyState,
  PanelSkeleton,
  ScoreBar,
  StatusChip,
  asArray,
  formatContactability,
  formatLifecycle,
  formatNextAction,
  formatProspectType,
  formatResultsCompact,
  hasEmail,
  marketLabel,
  needsContactResearch,
  parseTimeline,
  previewText,
  prospectScore,
  queueForProspect,
  formatDate,
} from './components';
import { adminApiService } from '@/services/adminApiService';

interface Props extends PanelSharedProps {
  initialFilters?: ProspectFilters;
}

const stickyProspectSx = {
  position: 'sticky' as const,
  left: 40,
  zIndex: 2,
  bgcolor: 'background.paper',
  minWidth: 160,
  maxWidth: 220,
};

const stickyProspectHeadSx = {
  ...stickyProspectSx,
  zIndex: 3,
  fontWeight: 700,
};

const stickyActionsSx = {
  position: 'sticky' as const,
  right: 0,
  zIndex: 2,
  bgcolor: 'background.paper',
  minWidth: 150,
};

const stickyActionsHeadSx = {
  ...stickyActionsSx,
  zIndex: 3,
  fontWeight: 700,
};

const stickyCheckSx = {
  position: 'sticky' as const,
  left: 0,
  zIndex: 2,
  bgcolor: 'background.paper',
  width: 40,
  px: 0.5,
};

const stickyCheckHeadSx = {
  ...stickyCheckSx,
  zIndex: 3,
};

export const ProspectsPanel: React.FC<Props> = ({
  onError,
  onNotice,
  refreshKey,
  requestRefresh,
  initialFilters,
}) => {
  const [prospects, setProspects] = useState<PartnerProspect[]>([]);
  const [queue, setQueue] = useState<PartnerQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PartnerProspect | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
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
      const [p, q] = await Promise.all([
        adminApiService.get(`${API}/prospects`),
        adminApiService.get(`${API}/queue`),
      ]);
      setProspects(asArray<PartnerProspect>(p));
      setQueue(asArray<PartnerQueueItem>(q));
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Failed to load prospects');
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

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
        const t = (p.prospectKind || p.prospectType || p.organizationType || 'organization').toLowerCase();
        if (t !== filters.prospectType.toLowerCase()) return false;
      }
      if (filters.scoreMin != null && filters.scoreMin > 0) {
        if (prospectScore(p) < filters.scoreMin) return false;
      }
      if (filters.contactAvailable === 'available' && !hasEmail(p)) return false;
      if (filters.contactAvailable === 'needed') {
        if (!needsContactResearch(p)) return false;
      }
      if (filters.lifecycle) {
        const life = (p.crmLifecycle || '').toUpperCase();
        if (life !== filters.lifecycle.toUpperCase()) return false;
      }
      if (filters.contactState) {
        const state = (p.contactabilityState || p.contactState || '').toUpperCase();
        if (state !== filters.contactState.toUpperCase()) return false;
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

  const refreshSelected = async (prospectId: string) => {
    const refreshed = asArray<PartnerProspect>(await adminApiService.get(`${API}/prospects`));
    setProspects(refreshed);
    const next = refreshed.find((x) => x.prospectId === prospectId) || null;
    setSelected(next);
  };

  const act = async (label: string, fn: () => Promise<unknown>) => {
    onError(null);
    try {
      await fn();
      onNotice(label);
      requestRefresh();
      await load();
      if (selected) await refreshSelected(selected.prospectId);
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Action failed');
    }
  };

  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(filtered.map((p) => p.prospectId)));
  };

  const researchOne = async (p: PartnerProspect) => {
    setBusy(true);
    onError(null);
    try {
      await adminApiService.post(`${API}/prospects/${encodeURIComponent(p.prospectId)}/research-contact`, {});
      onNotice(`Researched contact for ${p.organizationName || p.prospectId}`);
      requestRefresh();
      await load();
      if (selected?.prospectId === p.prospectId) await refreshSelected(p.prospectId);
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Contact research failed');
    } finally {
      setBusy(false);
    }
  };

  const researchBulk = async () => {
    if (selectedIds.size === 0) return;
    setBusy(true);
    onError(null);
    try {
      await adminApiService.post(`${API}/prospects/research-contacts`, {
        prospectIds: [...selectedIds],
      });
      onNotice(`Research contacts started for ${selectedIds.size} prospect(s)`);
      setSelectedIds(new Set());
      requestRefresh();
      await load();
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Bulk contact research failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading && prospects.length === 0) return <PanelSkeleton rows={8} />;

  const drawerQueue = selected ? queueForProspect(queue, selected.prospectId) : [];
  const timeline = selected ? parseTimeline(selected.timelineJson) : [];
  const strategic = selected?.strategicScore ?? selected?.historicalCategoryScore;
  const contactabilityLabel = selected ? formatContactability(selected) : '';

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
                {formatProspectType(c)}
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
            <MenuItem value="GYM">Gym</MenuItem>
            <MenuItem value="STUDIO">Studio</MenuItem>
            <MenuItem value="SPORTS_CLUB">Sports club</MenuItem>
            <MenuItem value="RUN_CLUB">Running club</MenuItem>
            <MenuItem value="REC_LEAGUE">Rec league</MenuItem>
            <MenuItem value="COACH">Coach</MenuItem>
            <MenuItem value="TRAINER">Trainer</MenuItem>
            <MenuItem value="CREATOR">Creator</MenuItem>
            <MenuItem value="COMMUNITY">Community</MenuItem>
            <MenuItem value="EVENT_ORGANIZER">Event organizer</MenuItem>
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
                {formatLifecycle(l)}
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
        <Box sx={{ flex: 1 }} />
        <Button size="small" onClick={toggleAll} disabled={filtered.length === 0}>
          {selectedIds.size === filtered.length && filtered.length > 0 ? 'Clear selection' : 'Select all'}
        </Button>
        <Button
          size="small"
          variant="contained"
          disabled={selectedIds.size === 0 || busy}
          onClick={() => void researchBulk()}
        >
          Research contacts ({selectedIds.size})
        </Button>
      </Stack>

      {filtered.length === 0 ? (
        <EmptyState title="No prospects match" detail="Adjust filters or run discovery from Acquisition." />
      ) : (
        <TableContainer
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            maxHeight: '70vh',
            overflowX: 'auto',
          }}
        >
          <Table stickyHeader size="small" sx={{ tableLayout: 'fixed', minWidth: 960 }}>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" sx={stickyCheckHeadSx}>
                  <Checkbox
                    size="small"
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    indeterminate={selectedIds.size > 0 && selectedIds.size < filtered.length}
                    onChange={toggleAll}
                  />
                </TableCell>
                <TableCell sx={stickyProspectHeadSx}>Prospect</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 110 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 130 }}>Market</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 64 }}>Score</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 130 }}>Contact</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 100 }}>Lifecycle</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 140 }}>Next Action</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 120 }}>Results</TableCell>
                <TableCell sx={stickyActionsHeadSx}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((p) => {
                const qItems = queueForProspect(queue, p.prospectId);
                const next = formatNextAction(p, qItems);
                const canDraft = hasEmail(p) && !qItems.some((q) => q.status === 'draft');
                const canResearch = needsContactResearch(p);
                return (
                  <TableRow
                    key={p.prospectId}
                    hover
                    selected={selectedIds.has(p.prospectId)}
                    sx={{ cursor: 'pointer' }}
                    onClick={() => setSelected(p)}
                  >
                    <TableCell
                      padding="checkbox"
                      sx={stickyCheckSx}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        size="small"
                        checked={selectedIds.has(p.prospectId)}
                        onChange={() => toggleId(p.prospectId)}
                      />
                    </TableCell>
                    <TableCell sx={stickyProspectSx}>
                      <Typography sx={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3 }} noWrap>
                        {p.organizationName || '—'}
                      </Typography>
                      {p.contactName && (
                        <Typography variant="caption" color="text.secondary" noWrap display="block">
                          {p.contactName}
                          {p.contactRole ? ` · ${p.contactRole}` : ''}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{formatProspectType(p)}</TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{marketLabel(p)}</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{prospectScore(p)}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>
                      <Typography variant="body2" sx={{ fontSize: 12, lineHeight: 1.3 }}>
                        {formatContactability(p)}
                      </Typography>
                      {hasEmail(p) && (
                        <Typography variant="caption" color="text.secondary" noWrap display="block">
                          {p.email}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusChip label={formatLifecycle(p.crmLifecycle || p.status)} color="info" />
                    </TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{next}</TableCell>
                    <TableCell sx={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {formatResultsCompact(p)}
                    </TableCell>
                    <TableCell sx={stickyActionsSx} onClick={(e) => e.stopPropagation()}>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                        {canResearch && (
                          <Button size="small" disabled={busy} onClick={() => void researchOne(p)}>
                            Research contact
                          </Button>
                        )}
                        {canDraft && (
                          <Button
                            size="small"
                            disabled={busy}
                            onClick={() =>
                              void act('Draft prepared', () =>
                                adminApiService.post(`${API}/drafts`, {
                                  prospectId: p.prospectId,
                                  campaignId: p.campaignId,
                                }),
                              )
                            }
                          >
                            Prepare draft
                          </Button>
                        )}
                        <Button size="small" onClick={() => setSelected(p)}>
                          Open
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Drawer anchor="right" open={!!selected} onClose={() => setSelected(null)} PaperProps={{ sx: { width: { xs: '100%', sm: 460 } } }}>
        {selected && (
          <Box sx={{ p: 2.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              {selected.organizationName}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {marketLabel(selected)} · {formatProspectType(selected)}
            </Typography>

            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Identity
            </Typography>
            <Typography variant="body2">Email: {selected.email || '—'}</Typography>
            <Typography variant="body2">
              Contact: {selected.contactName || '—'} {selected.contactRole ? `(${selected.contactRole})` : ''}
            </Typography>
            <Typography variant="body2">Website: {selected.website || '—'}</Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Source: {selected.discoverySource || selected.sourceUrl || '—'}
            </Typography>

            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Acquisition score
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>
              Total {selected.acquisitionScore ?? prospectScore(selected)}/100
            </Typography>
            <ScoreBar label="Audience fit" value={selected.audienceFitScore} max={25} />
            <ScoreBar label="Market" value={selected.marketRelevanceScore} max={20} />
            <ScoreBar label="Community" value={selected.communityFitScore} max={22} />
            <ScoreBar label="Strategic / Historical" value={strategic} max={15} />
            {selected.activityScore != null && (
              <ScoreBar label="Activity" value={selected.activityScore} max={20} />
            )}
            {selected.scoreExplanation && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5, mb: 1.5 }}>
                {selected.scoreExplanation}
              </Typography>
            )}

            <Divider sx={{ my: 1.5 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
              Contactability
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              {contactabilityLabel}
              {selected.contactabilityScore != null ? ` · score ${selected.contactabilityScore}/100` : ''}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              disabled={busy || !selected.website}
              onClick={() => void researchOne(selected)}
              sx={{ mb: 1.5 }}
            >
              Research contact
            </Button>

            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Next action
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {formatNextAction(selected, drawerQueue)}
            </Typography>

            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Lifecycle
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {formatLifecycle(selected.crmLifecycle || selected.status)}
            </Typography>

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
                  <StatusChip label={formatLifecycle(q.status)} />
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
              {hasEmail(selected) && !drawerQueue.some((q) => q.status === 'draft') && (
                <Button
                  variant="contained"
                  size="small"
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
              )}
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
