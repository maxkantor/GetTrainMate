import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
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
  Tooltip,
  Typography,
} from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import type {
  NavigateFilters,
  NextActionInfo,
  PanelSharedProps,
  PartnerProspect,
  PartnerQueueItem,
  ProspectDetailResponse,
  ProspectFilters,
} from './types';
import {
  API,
  EmptyState,
  PanelSkeleton,
  ScoreBar,
  StatusChip,
  asArray,
  canShowPartnershipActions,
  formatAcquisitionStatus,
  formatContactSource,
  formatContactability,
  formatCustomerStatus,
  formatDate,
  formatDistributionStatus,
  formatLifecycle,
  formatPartnershipStatus,
  formatProspectType,
  formatResultsCompact,
  hasEmail,
  marketLabel,
  needsContactResearch,
  parseTimeline,
  previewText,
  prospectScore,
  queueForProspect,
  resolveNextAction,
  startDiscoveryJob,
  pollDiscoveryJob,
  discoverySummary,
} from './components';
import { adminApiService } from '@/services/adminApiService';
import {
  contactJobProgressFrom,
  DEFAULT_RESEARCH_STAGES,
  isContactJobRunning,
  isContactJobTerminal,
  classifyDiscoveryStatus,
  summarizeContactJob,
  summarizeResearchResult,
} from './researchContact';
import type {
  ContactDiscoveryJob,
  PipelineCounters,
  ResearchResult,
  ResearchStage,
} from './researchContact';

type ContactFormMode = 'closed' | 'form';

/** Discovery is capped per request so a batch stays inside the API time budget. */
const DISCOVERY_BATCH_MAX = 200;

function stageGlyph(state: ResearchStage['state']): string {
  if (state === 'done') return '✓';
  if (state === 'active') return '→';
  return '○';
}

function animateStages(base: ResearchStage[], tick: number): ResearchStage[] {
  if (base.some((s) => s.state === 'done')) return base;
  const idx = tick % base.length;
  return base.map((s, i) => ({
    ...s,
    state: i < idx ? 'done' : i === idx ? 'active' : 'pending',
  }));
}

type ManualContactForm = {
  email: string;
  contactName: string;
  contactRole: string;
  phone: string;
  sourceUrl: string;
  notes: string;
};

const emptyContactForm = (p?: PartnerProspect | null): ManualContactForm => ({
  email: p?.email || '',
  contactName: p?.contactName || '',
  contactRole: p?.contactRole || '',
  phone: p?.phone || '',
  // Do not prefill with the org website — that is often a dead listing URL, not an email source.
  sourceUrl: p?.contactSourceUrl || '',
  notes: '',
});

function isValidEmailSyntax(email: string): boolean {
  const e = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

interface Props extends PanelSharedProps {
  initialFilters?: ProspectFilters;
  onNavigate?: (nav: NavigateFilters) => void;
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
  onNavigate,
}) => {
  const [prospects, setProspects] = useState<PartnerProspect[]>([]);
  const [queue, setQueue] = useState<PartnerQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PartnerProspect | null>(null);
  const [detailNext, setDetailNext] = useState<NextActionInfo | string | null>(null);
  const [detailTimeline, setDetailTimeline] = useState<
    Array<{ at?: string; type?: string; note?: string; label?: string }>
  >([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [researchBanner, setResearchBanner] = useState<{
    severity: 'success' | 'error' | 'warning' | 'info';
    text: string;
  } | null>(null);
  const [contactMode, setContactMode] = useState<ContactFormMode>('closed');
  const [contactForm, setContactForm] = useState<ManualContactForm>(emptyContactForm());
  const [contactBusy, setContactBusy] = useState(false);
  const [discoverJob, setDiscoverJob] = useState<ContactDiscoveryJob | null>(null);
  const [pipeline, setPipeline] = useState<PipelineCounters | null>(null);
  const [discoverMoreBusy, setDiscoverMoreBusy] = useState(false);
  const [stageTick, setStageTick] = useState(0);
  const pollCancelRef = useRef<{ cancelled: boolean }>({ cancelled: false });
  const [confirmDiscovery, setConfirmDiscovery] = useState<{ ids: string[] } | null>(null);
  const [duplicateWarn, setDuplicateWarn] = useState<{
    message: string;
    organizationName?: string;
    type?: string;
  } | null>(null);
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
    try {
      const [p, q, counters] = await Promise.all([
        adminApiService.get(`${API}/prospects`),
        adminApiService.get(`${API}/queue`),
        adminApiService.get(`${API}/prospects/pipeline-counters`).catch(() => null),
      ]);
      setProspects(asArray<PartnerProspect>(p));
      setQueue(asArray<PartnerQueueItem>(q));
      if (counters) setPipeline(counters as PipelineCounters);
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Failed to load prospects');
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const publishResearch = (summary: { ok: boolean; text: string; kind: string }) => {
    const severity =
      summary.ok
        ? 'success'
        : summary.kind === 'website_dead'
          ? 'error'
          : summary.kind === 'contact_form'
            ? 'info'
            : summary.kind === 'not_found' || summary.kind === 'review_required'
              ? 'warning'
              : 'error';
    setResearchBanner({ severity, text: summary.text });
    onError(null);
    onNotice(null);
  };

  const runContactJobPoll = useCallback(
    async (jobId: string) => {
      const signal = pollCancelRef.current;
      while (!signal.cancelled) {
        try {
          const job = (await adminApiService.get(
            `${API}/prospects/contact-discovery/jobs/${encodeURIComponent(jobId)}`,
          )) as ContactDiscoveryJob;
          setDiscoverJob(job);
          if ((job.processed ?? 0) > 0) await load();
          if (isContactJobTerminal(job.status)) {
            publishResearch(summarizeContactJob(job));
            await load();
            return;
          }
          if ((job.status || '').toLowerCase() === 'paused') return;
        } catch (e: unknown) {
          const text = e instanceof Error ? e.message : 'Contact discovery poll failed';
          setResearchBanner({ severity: 'error', text });
          return;
        }
        await new Promise((r) => setTimeout(r, 400));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [load],
  );

  const pollRef = useRef(runContactJobPoll);
  pollRef.current = runContactJobPoll;

  /** Reconnect to an in-flight durable contact job after refresh / tab return. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const active = (await adminApiService.get(
          `${API}/prospects/contact-discovery/active`,
        )) as ContactDiscoveryJob & { active?: boolean };
        if (cancelled || !active?.jobId) return;
        if (active.active === false && !isContactJobRunning(active.status) && active.status !== 'paused')
          return;
        setDiscoverJob(active);
        if (isContactJobRunning(active.status)) {
          pollCancelRef.current = { cancelled: false };
          void pollRef.current(active.jobId);
        }
      } catch {
        // Active endpoint may not be deployed yet.
      }
    })();
    return () => {
      cancelled = true;
      pollCancelRef.current.cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!discoverJob || !isContactJobRunning(discoverJob.status)) return;
    const id = window.setInterval(() => setStageTick((t) => t + 1), 1200);
    return () => window.clearInterval(id);
  }, [discoverJob?.jobId, discoverJob?.status]);

  const loadDetail = async (prospectId: string) => {
    try {
      const detail = (await adminApiService.get(
        `${API}/prospects/${encodeURIComponent(prospectId)}/detail`,
      )) as ProspectDetailResponse;
      if (detail?.prospect) setSelected(detail.prospect);
      setDetailNext(detail?.nextAction ?? detail?.prospect?.nextAction ?? null);
      if (Array.isArray(detail?.timeline) && detail.timeline.length) {
        setDetailTimeline(detail.timeline);
      } else {
        setDetailTimeline(parseTimeline(detail?.prospect?.timelineJson));
      }
      if (detail?.queue || detail?.queueItems) {
        const items = asArray<PartnerQueueItem>(detail.queue || detail.queueItems);
        setQueue((prev) => {
          const others = prev.filter((q) => q.prospectId !== prospectId);
          return [...others, ...items];
        });
      }
    } catch {
      // Detail endpoint may not be deployed yet — fall back to list row
      setDetailNext(null);
      const row = prospects.find((x) => x.prospectId === prospectId);
      setDetailTimeline(parseTimeline(row?.timelineJson));
    }
  };

  const openProspect = (p: PartnerProspect) => {
    setSelected(p);
    setDetailNext(p.nextAction ?? null);
    setDetailTimeline(parseTimeline(p.timelineJson));
    setContactMode('closed');
    setDuplicateWarn(null);
    setContactForm(emptyContactForm(p));
    void loadDetail(p.prospectId);
  };

  /** Manual add/edit is always available, whatever the acquisition status is. */
  const openContactForm = (p: PartnerProspect) => {
    setContactMode('form');
    setDuplicateWarn(null);
    setContactForm(emptyContactForm(p));
  };

  const applyManualContactResult = async (raw: {
    ok?: boolean;
    needsConfirm?: boolean;
    message?: string;
    reason?: string;
    duplicate?: { organizationName?: string; type?: string };
    suppressed?: boolean;
    suppressionReason?: string;
    sendable?: boolean;
    prospect?: PartnerProspect;
    nextAction?: NextActionInfo | string;
    queueItems?: PartnerQueueItem[];
    email?: string;
  }) => {
    if (raw?.needsConfirm) {
      setDuplicateWarn({
        message: raw.message || 'This email already belongs to another record.',
        organizationName: raw.duplicate?.organizationName,
        type: raw.duplicate?.type,
      });
      return false;
    }
    if (raw?.ok === false) {
      onError(raw.message || raw.reason || 'Could not save contact');
      return false;
    }

    setDuplicateWarn(null);
    setContactMode('closed');
    if (raw.prospect) {
      setSelected(raw.prospect);
      setProspects((prev) =>
        prev.map((x) => (x.prospectId === raw.prospect!.prospectId ? { ...x, ...raw.prospect! } : x)),
      );
    }
    if (raw.nextAction) setDetailNext(raw.nextAction);
    if (Array.isArray(raw.queueItems)) {
      setQueue((prev) => {
        const pid = raw.prospect?.prospectId || selected?.prospectId;
        if (!pid) return prev;
        const others = prev.filter((q) => q.prospectId !== pid);
        return [...others, ...raw.queueItems!];
      });
    }

    const bits = [
      raw.email ? `Saved ${raw.email}` : 'Contact saved',
      raw.suppressed
        ? `Suppressed (${raw.suppressionReason || 'listed'}) — stored but not sendable`
        : null,
    ].filter(Boolean);
    const text = bits.join(' · ');
    setResearchBanner({
      severity: raw.suppressed ? 'warning' : 'success',
      text,
    });
    if (raw.suppressed) onError(text);
    else onNotice(text);
    await load();
    return true;
  };

  const saveManualContact = async (confirmDuplicate = false) => {
    if (!selected) return;
    const email = contactForm.email.trim().toLowerCase();
    if (!isValidEmailSyntax(email)) {
      onError('Enter a valid email address.');
      setResearchBanner({ severity: 'error', text: 'Enter a valid email address.' });
      return;
    }
    setContactBusy(true);
    onError(null);
    onNotice(null);
    try {
      const raw = (await adminApiService.post(
        `${API}/prospects/${encodeURIComponent(selected.prospectId)}/manual-contact`,
        {
          email,
          contactName: contactForm.contactName.trim() || undefined,
          contactRole: contactForm.contactRole.trim() || undefined,
          phone: contactForm.phone.trim() || undefined,
          sourceUrl: contactForm.sourceUrl.trim() || undefined,
          notes: contactForm.notes.trim() || undefined,
          confirmDuplicate,
        },
      )) as {
        ok?: boolean;
        needsConfirm?: boolean;
        message?: string;
        reason?: string;
        duplicate?: { organizationName?: string; type?: string };
        suppressed?: boolean;
        suppressionReason?: string;
        sendable?: boolean;
        prospect?: PartnerProspect;
        nextAction?: NextActionInfo | string;
        queueItems?: PartnerQueueItem[];
        email?: string;
      };
      await applyManualContactResult(raw);
    } catch (e: unknown) {
      const text = e instanceof Error ? e.message : 'Failed to save contact';
      setResearchBanner({ severity: 'error', text });
      onError(text);
    } finally {
      setContactBusy(false);
    }
  };

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

  /** Filtered rows that can still be researched: a website to probe and no email yet. */
  const missingContacts = useMemo(
    () => filtered.filter((p) => Boolean(p.website) && !hasEmail(p)),
    [filtered],
  );

  const refreshSelected = async (prospectId: string) => {
    const refreshed = asArray<PartnerProspect>(await adminApiService.get(`${API}/prospects`));
    setProspects(refreshed);
    const next = refreshed.find((x) => x.prospectId === prospectId) || null;
    setSelected(next);
    if (next) void loadDetail(prospectId);
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
    onNotice(null);
    setResearchBanner(null);
    const name = p.organizationName || p.prospectId;
    try {
      // Explicit admin click always forces through cooldown / attempt gates.
      const raw = (await adminApiService.post(
        `${API}/prospects/${encodeURIComponent(p.prospectId)}/discover-contact`,
        { force: true },
      )) as ResearchResult;
      // Reload first — load must NOT clear banners (that was the blink bug).
      await load();
      if (selected?.prospectId === p.prospectId) await refreshSelected(p.prospectId);
      publishResearch(summarizeResearchResult(raw, name));
    } catch (e: unknown) {
      const text = e instanceof Error ? e.message : 'Contact research failed';
      setResearchBanner({ severity: 'error', text });
      onError(text);
    } finally {
      setBusy(false);
    }
  };

  const discoverContacts = async (ids: string[]) => {
    if (ids.length === 0) return;
    const batch = ids.slice(0, DISCOVERY_BATCH_MAX);
    setBusy(true);
    onError(null);
    onNotice(null);
    setResearchBanner(null);
    pollCancelRef.current = { cancelled: false };
    try {
      const job = (await adminApiService.post(`${API}/prospects/contact-discovery/jobs`, {
        prospectIds: batch,
        filterMissingOnly: true,
        max: batch.length,
        force: true,
      })) as ContactDiscoveryJob;
      setDiscoverJob(job);
      setSelectedIds(new Set());
      if (isContactJobTerminal(job.status)) {
        publishResearch(summarizeContactJob(job));
        await load();
        return;
      }
      setBusy(false);
      await runContactJobPoll(job.jobId);
    } catch (e: unknown) {
      const text = e instanceof Error ? e.message : 'Contact discovery failed';
      setResearchBanner({ severity: 'error', text });
      onError(text);
    } finally {
      setBusy(false);
    }
  };

  const pauseDiscovery = async () => {
    if (!discoverJob?.jobId) return;
    pollCancelRef.current.cancelled = true;
    try {
      const job = (await adminApiService.post(
        `${API}/prospects/contact-discovery/jobs/${encodeURIComponent(discoverJob.jobId)}/pause`,
        {},
      )) as ContactDiscoveryJob;
      setDiscoverJob(job);
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Could not pause discovery');
    }
  };

  const resumeDiscovery = async () => {
    if (!discoverJob?.jobId) return;
    pollCancelRef.current = { cancelled: false };
    try {
      const job = (await adminApiService.post(
        `${API}/prospects/contact-discovery/jobs/${encodeURIComponent(discoverJob.jobId)}/resume`,
        {},
      )) as ContactDiscoveryJob;
      setDiscoverJob(job);
      if (isContactJobRunning(job.status)) void runContactJobPoll(job.jobId);
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Could not resume discovery');
    }
  };

  const retryFailedDiscovery = async () => {
    if (!discoverJob?.jobId) return;
    pollCancelRef.current = { cancelled: false };
    try {
      const job = (await adminApiService.post(
        `${API}/prospects/contact-discovery/jobs/${encodeURIComponent(discoverJob.jobId)}/retry-failed`,
        {},
      )) as ContactDiscoveryJob;
      setDiscoverJob(job);
      if (isContactJobRunning(job.status)) void runContactJobPoll(job.jobId);
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Could not retry failed prospects');
    }
  };

  const discoverMoreProspects = async () => {
    setDiscoverMoreBusy(true);
    onError(null);
    onNotice(null);
    try {
      const job = await startDiscoveryJob({ prepareDrafts: true });
      onNotice('Discovering more prospects…');
      await pollDiscoveryJob(job.jobId, () => undefined);
      const final = (await adminApiService.get(
        `${API}/discovery/jobs/${encodeURIComponent(job.jobId)}`,
      )) as { jobId: string; status: string; prospectsFound?: number; contactsFound?: number; draftsCreated?: number; error?: string };
      onNotice(discoverySummary(final));
      await load();
      requestRefresh();
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Discover more prospects failed');
    } finally {
      setDiscoverMoreBusy(false);
    }
  };

  const decidePendingContact = async (p: PartnerProspect, decision: 'accept' | 'reject') => {
    setContactBusy(true);
    onError(null);
    onNotice(null);
    try {
      const raw = (await adminApiService.post(
        `${API}/prospects/${encodeURIComponent(p.prospectId)}/pending-contact/${decision}`,
        {},
      )) as { ok?: boolean; email?: string; rejectedEmail?: string; message?: string; error?: string };
      if (raw?.ok === false) {
        const text = raw.message || raw.error || 'Could not update the pending contact';
        setResearchBanner({ severity: 'error', text });
        onError(text);
        return;
      }
      const text =
        decision === 'accept'
          ? `Accepted ${raw?.email || 'contact'} for ${p.organizationName || p.prospectId}`
          : `Rejected ${raw?.rejectedEmail || 'candidate'} for ${p.organizationName || p.prospectId}`;
      setResearchBanner({ severity: decision === 'accept' ? 'success' : 'info', text });
      onNotice(text);
      await load();
      await refreshSelected(p.prospectId);
    } catch (e: unknown) {
      const text = e instanceof Error ? e.message : 'Could not update the pending contact';
      setResearchBanner({ severity: 'error', text });
      onError(text);
    } finally {
      setContactBusy(false);
    }
  };

  const runPrimaryAction = async (
    p: PartnerProspect,
    qItems: PartnerQueueItem[],
    apiNext?: NextActionInfo | string | null,
  ) => {
    const next = resolveNextAction(p, qItems, apiNext);
    const key = next.key;
    if (key === 'RESEARCH_CONTACT') {
      await researchOne(p);
      return;
    }
    if (key === 'CREATE_OUTREACH' || key === 'QUALIFY') {
      setBusy(true);
      try {
        await act('Draft prepared', () =>
          adminApiService.post(`${API}/drafts`, {
            prospectId: p.prospectId,
            campaignId: p.campaignId,
          }),
        );
      } finally {
        setBusy(false);
      }
      return;
    }
    if (key === 'REVIEW_APPROVE' || key === 'SEND_OR_QUEUE' || key === 'SEND') {
      onNavigate?.({ tab: 'approvals', approvalsStatus: key === 'SEND_OR_QUEUE' || key === 'SEND' ? 'approved' : 'draft' });
      return;
    }
    if (key === 'READ_REPLY' || key === 'VIEW_REPLY') {
      onNavigate?.({ tab: 'inbox' });
      return;
    }
    if (key === 'VIEW_CUSTOMER') {
      onNavigate?.({ tab: 'customers' });
      return;
    }
    openProspect(p);
  };

  if (loading && prospects.length === 0) return <PanelSkeleton rows={8} />;

  const drawerQueue = selected ? queueForProspect(queue, selected.prospectId) : [];
  const timeline =
    detailTimeline.length > 0
      ? detailTimeline
      : selected
        ? parseTimeline(selected.timelineJson)
        : [];
  const strategic = selected?.strategicScore ?? selected?.historicalCategoryScore;
  const selectedNext = selected
    ? resolveNextAction(selected, drawerQueue, detailNext)
    : null;
  const showPartnership = selected ? canShowPartnershipActions(selected) : false;
  const jobProgress = discoverJob ? contactJobProgressFrom(discoverJob) : null;
  const jobRunning = Boolean(discoverJob && isContactJobRunning(discoverJob.status));
  const jobPaused = (discoverJob?.status || '').toLowerCase() === 'paused';
  const jobFailed = (discoverJob?.status || '').toLowerCase() === 'failed';
  const stagesForUi = jobRunning
    ? animateStages(
        jobProgress?.stages?.length ? jobProgress.stages : DEFAULT_RESEARCH_STAGES,
        stageTick,
      )
    : jobProgress?.stages?.length
      ? jobProgress.stages
      : DEFAULT_RESEARCH_STAGES;

  return (
    <Box>
      {(loading || discoverMoreBusy) && (
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            {discoverMoreBusy
              ? 'Discovering more prospects...'
              : 'Refreshing acquisition metrics...'}
          </Typography>
          <LinearProgress sx={{ mt: 0.5, height: 6, borderRadius: 1 }} />
        </Box>
      )}
      {researchBanner && (
        <Alert
          severity={researchBanner.severity}
          sx={{ mb: 2 }}
          onClose={() => setResearchBanner(null)}
        >
          {researchBanner.text}
        </Alert>
      )}

      <Box
        sx={{
          mb: 2,
          p: 1.5,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1.5,
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: 0.8 }}>
          CONTACT PIPELINE
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5, mb: 1.25 }}>
          {pipeline?.prospects ?? prospects.length} Prospects · {pipeline?.emailsFound ?? '—'} usable
          contacts · {pipeline?.needContact ?? '—'} need contact · {pipeline?.readyToReview ?? '—'}{' '}
          awaiting approval · {pipeline?.approved ?? '—'} ready to send · Sent {pipeline?.sentToday ?? '—'}{' '}
          today / {pipeline?.sent7d ?? '—'} 7d / {pipeline?.sentLifetime ?? pipeline?.sentToday ?? '—'}{' '}
          lifetime · Partners {pipeline?.partners7d ?? '—'} 7d / {pipeline?.partnersLifetime ?? '—'}{' '}
          lifetime
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button
            size="small"
            variant="outlined"
            disabled={discoverMoreBusy || busy || jobRunning}
            onClick={() => void discoverMoreProspects()}
          >
            {discoverMoreBusy ? 'Discovering…' : 'Discover more prospects'}
          </Button>
          <Button
            size="small"
            variant="contained"
            disabled={missingContacts.length === 0 || busy || jobRunning}
            onClick={() =>
              setConfirmDiscovery({ ids: missingContacts.map((p) => p.prospectId) })
            }
          >
            Discover contacts ({missingContacts.length})
          </Button>
          {selectedIds.size > 0 && (
            <Button
              size="small"
              variant="outlined"
              disabled={busy || jobRunning}
              onClick={() => setConfirmDiscovery({ ids: [...selectedIds] })}
            >
              Find contacts for selected ({selectedIds.size})
            </Button>
          )}
        </Stack>
      </Box>

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
      </Stack>

      {jobProgress && (
        <Box
          sx={{
            mb: 2,
            p: 1.5,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1.5,
            bgcolor: 'action.hover',
          }}
        >
          <Stack direction="row" alignItems="center" sx={{ mb: 0.75 }} spacing={1}>
            <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: 0.6, flex: 1 }}>
              {jobRunning ? 'Discovering contacts' : jobPaused ? 'PAUSED' : isContactJobTerminal(discoverJob?.status) ? 'COMPLETE' : 'CONTACT DISCOVERY'}
            </Typography>
            {jobProgress.measurable && jobProgress.progressPct != null && (
              <Typography variant="body2" sx={{ fontWeight: 800 }}>
                {jobProgress.progressPct}%
              </Typography>
            )}
            {jobFailed && (
              <Typography variant="body2" color="error" sx={{ fontWeight: 800 }}>
                ERROR
              </Typography>
            )}
            {!jobRunning && !jobPaused && (
              <Button size="small" onClick={() => setDiscoverJob(null)}>
                Dismiss
              </Button>
            )}
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
            {jobFailed
              ? discoverJob?.error || 'Contact discovery failed'
              : jobRunning && !jobProgress.measurable
                ? 'Discovering public contact information…'
                : jobRunning
                  ? 'Discovering contacts'
                  : jobPaused
                    ? 'Paused — resume to continue'
                    : isContactJobTerminal(discoverJob?.status)
                      ? 'Discovery complete'
                      : 'Status'}
          </Typography>
          <LinearProgress
            variant={jobProgress.measurable ? 'determinate' : 'indeterminate'}
            value={jobProgress.measurable ? Math.min(100, Math.max(0, jobProgress.progressPct ?? 0)) : undefined}
            sx={{ height: 10, borderRadius: 1, mb: 1 }}
          />
          {jobProgress.measurable ? (
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              Processed: {jobProgress.processed} / {jobProgress.total}
            </Typography>
          ) : (
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {jobRunning ? 'Progress will appear after the first prospect is processed.' : `${jobProgress.processed} of ${jobProgress.total} processed`}
            </Typography>
          )}
          {(jobRunning || jobPaused) && jobProgress.currentProspectName && (
            <Box sx={{ mt: 1.25 }}>
              <Typography variant="caption" color="text.secondary">
                Currently researching
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {jobProgress.currentProspectName}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
                Checking
              </Typography>
              <Stack spacing={0.25} sx={{ mt: 0.25 }}>
                {stagesForUi.map((s) => (
                  <Typography
                    key={s.key}
                    variant="body2"
                    sx={{ opacity: s.state === 'pending' ? 0.55 : 1, fontWeight: s.state === 'active' ? 700 : 400 }}
                  >
                    {stageGlyph(s.state)} {s.label}
                  </Typography>
                ))}
              </Stack>
            </Box>
          )}
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
            <Typography variant="body2">Public emails found: {jobProgress.emailsFound}</Typography>
            <Typography variant="body2">No public email: {jobProgress.noContact}</Typography>
            <Typography variant="body2">Needs review: {jobProgress.reviewRequired}</Typography>
            <Typography variant="body2">Errors: {jobProgress.errors}</Typography>
            <Typography variant="body2">Contact forms: {jobProgress.formsFound}</Typography>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ mt: 1.25 }}>
            {jobRunning && (
              <Button size="small" variant="outlined" onClick={() => void pauseDiscovery()}>
                Pause discovery
              </Button>
            )}
            {jobPaused && (
              <Button size="small" variant="contained" onClick={() => void resumeDiscovery()}>
                Resume discovery
              </Button>
            )}
            {isContactJobTerminal(discoverJob?.status) && (jobProgress.errors > 0) && (
              <Button size="small" variant="outlined" onClick={() => void retryFailedDiscovery()}>
                Retry failed
              </Button>
            )}
          </Stack>
        </Box>
      )}

      {filtered.length === 0 ? (
        <EmptyState title="No prospects match" detail="Adjust filters or run discovery from Overview." />
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
                <TableCell sx={{ fontWeight: 700, width: 110 }}>Acquisition</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 140 }}>Next Action</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 120 }}>Results</TableCell>
                <TableCell sx={stickyActionsHeadSx}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((p) => {
                const qItems = queueForProspect(queue, p.prospectId);
                const next = resolveNextAction(p, qItems);
                return (
                  <TableRow
                    key={p.prospectId}
                    hover
                    selected={selectedIds.has(p.prospectId)}
                    sx={{ cursor: 'pointer' }}
                    onClick={() => openProspect(p)}
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
                        {classifyDiscoveryStatus(p.contactDiscoveryStatus, hasEmail(p)) ||
                          formatContactability(p)}
                      </Typography>
                      {hasEmail(p) && (
                        <Typography variant="caption" color="text.secondary" noWrap display="block">
                          {p.email}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusChip
                        label={formatAcquisitionStatus(p.acquisitionStatus) !== '—'
                          ? formatAcquisitionStatus(p.acquisitionStatus)
                          : formatLifecycle(p.crmLifecycle || p.status)}
                        color="info"
                      />
                    </TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{next.label}</TableCell>
                    <TableCell sx={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {formatResultsCompact(p)}
                    </TableCell>
                    <TableCell sx={stickyActionsSx} onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="small"
                        variant="contained"
                        disabled={busy}
                        onClick={() => void runPrimaryAction(p, qItems)}
                      >
                        {next.primaryButton}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Drawer
        anchor="right"
        open={!!selected}
        onClose={() => {
          setSelected(null);
          setDetailNext(null);
          setDetailTimeline([]);
          setContactMode('closed');
          setDuplicateWarn(null);
        }}
        PaperProps={{ sx: { width: { xs: '100%', sm: 480 } } }}
      >
        {selected && selectedNext && (
          <Box sx={{ p: 2.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              {selected.organizationName}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {marketLabel(selected)} · {formatProspectType(selected)}
            </Typography>

            <Button
              fullWidth
              variant="contained"
              size="large"
              disabled={busy || contactBusy}
              onClick={() => void runPrimaryAction(selected, drawerQueue, detailNext)}
              sx={{ mb: 2, fontWeight: 800 }}
            >
              {selectedNext.primaryButton}
            </Button>

            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
              Contact
            </Typography>

            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
              <Typography variant="body2" sx={{ flex: 1 }} noWrap>
                Email: {selected.email || '—'}
              </Typography>
              {hasEmail(selected) ? (
                <Tooltip title="Edit email">
                  <span>
                    <IconButton
                      size="small"
                      aria-label="Edit email"
                      disabled={contactBusy}
                      onClick={() => openContactForm(selected)}
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              ) : (
                <Button
                  size="small"
                  variant="outlined"
                  disabled={contactBusy}
                  onClick={() => openContactForm(selected)}
                >
                  + Add
                </Button>
              )}
            </Stack>
            <Typography variant="body2">
              Contact: {selected.contactName || '—'}{' '}
              {selected.contactRole ? `(${selected.contactRole})` : ''}
            </Typography>
            {selected.phone && (
              <Typography variant="body2">Phone: {selected.phone}</Typography>
            )}
            <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
              Website:{' '}
              {selected.website ? (
                <Box
                  component="a"
                  href={selected.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ color: 'primary.main' }}
                >
                  {selected.website}
                </Box>
              ) : (
                '—'
              )}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
              Find contact scrapes this URL. If it is a parking / “not connected” page, use Enter
              contact manually.
            </Typography>
            <Typography variant="body2">
              Source: {formatContactSource(selected)}
              {selected.contactSourceUrl ? ` · ${selected.contactSourceUrl}` : ''}
            </Typography>
            <Typography variant="body2">
              Status: {formatContactability(selected)}
              {selected.contactabilityScore != null
                ? ` · score ${selected.contactabilityScore}/100`
                : ''}
              {selected.contactConfidence
                ? ` · ${selected.contactConfidence.toLowerCase()} confidence`
                : ''}
            </Typography>
            {selected.lastContactResearchSummary && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                Last researched {formatDate(selected.lastContactResearchAt)} —{' '}
                {selected.lastContactResearchSummary}
              </Typography>
            )}
            {selected.contactFormUrl && (
              <Typography variant="body2" sx={{ mt: 0.25, wordBreak: 'break-all' }}>
                <Box
                  component="a"
                  href={selected.contactFormUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ color: 'primary.main' }}
                >
                  Contact form
                </Box>
              </Typography>
            )}

            {selected.pendingReviewEmail && (
              <Alert severity="warning" sx={{ mt: 1.5, mb: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  Review required: {selected.pendingReviewEmail}
                </Typography>
                <Typography variant="caption" display="block">
                  {selected.pendingReviewConfidence
                    ? `${selected.pendingReviewConfidence.toLowerCase()} confidence`
                    : 'unverified confidence'}
                  {selected.pendingReviewSourceUrl ? ' · ' : ''}
                  {selected.pendingReviewSourceUrl && (
                    <Box
                      component="a"
                      href={selected.pendingReviewSourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ color: 'primary.main', wordBreak: 'break-all' }}
                    >
                      source
                    </Box>
                  )}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <Button
                    size="small"
                    variant="contained"
                    disabled={contactBusy || busy}
                    onClick={() => void decidePendingContact(selected, 'accept')}
                  >
                    Accept
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="warning"
                    disabled={contactBusy || busy}
                    onClick={() => void decidePendingContact(selected, 'reject')}
                  >
                    Reject
                  </Button>
                </Stack>
              </Alert>
            )}

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5, mb: 2 }}>
              <Button
                size="small"
                variant="outlined"
                disabled={busy || contactBusy}
                onClick={() => void researchOne(selected)}
              >
                {selected.lastContactResearchAt ||
                selected.lastResearchAt ||
                (selected.researchAttempts ?? 0) > 0
                  ? 'Research again'
                  : 'Find contact'}
              </Button>
              <Button
                size="small"
                variant="contained"
                disabled={contactBusy}
                onClick={() => openContactForm(selected)}
              >
                {hasEmail(selected) ? 'Edit contact' : 'Enter contact manually'}
              </Button>
            </Stack>

            {contactMode === 'form' && (
              <Box
                sx={{
                  mb: 2,
                  p: 1.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1.5,
                }}
              >
                <TextField
                  fullWidth
                  size="small"
                  required
                  label="Email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
                  sx={{ mb: 1 }}
                  autoFocus
                />
                <TextField
                  fullWidth
                  size="small"
                  label="Contact name"
                  value={contactForm.contactName}
                  onChange={(e) => setContactForm((f) => ({ ...f, contactName: e.target.value }))}
                  sx={{ mb: 1 }}
                />
                <TextField
                  fullWidth
                  size="small"
                  label="Job title / role"
                  value={contactForm.contactRole}
                  onChange={(e) => setContactForm((f) => ({ ...f, contactRole: e.target.value }))}
                  sx={{ mb: 1 }}
                />
                <TextField
                  fullWidth
                  size="small"
                  label="Phone"
                  value={contactForm.phone}
                  onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))}
                  sx={{ mb: 1 }}
                />
                <TextField
                  fullWidth
                  size="small"
                  label="Source URL"
                  value={contactForm.sourceUrl}
                  onChange={(e) => setContactForm((f) => ({ ...f, sourceUrl: e.target.value }))}
                  sx={{ mb: 1 }}
                />
                <TextField
                  fullWidth
                  size="small"
                  label="Notes"
                  value={contactForm.notes}
                  onChange={(e) => setContactForm((f) => ({ ...f, notes: e.target.value }))}
                  sx={{ mb: 1.25 }}
                  multiline
                  minRows={2}
                />
                {duplicateWarn && (
                  <Alert severity="warning" sx={{ mb: 1.25 }}>
                    {duplicateWarn.message}
                    {duplicateWarn.organizationName
                      ? ` (${duplicateWarn.type || 'record'}: ${duplicateWarn.organizationName})`
                      : ''}
                  </Alert>
                )}
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Button
                    size="small"
                    onClick={() => {
                      setContactMode('closed');
                      setDuplicateWarn(null);
                    }}
                    disabled={contactBusy}
                  >
                    Cancel
                  </Button>
                  {duplicateWarn ? (
                    <Button
                      size="small"
                      variant="contained"
                      color="warning"
                      disabled={contactBusy}
                      onClick={() => void saveManualContact(true)}
                    >
                      Save anyway
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      variant="contained"
                      disabled={contactBusy}
                      onClick={() => void saveManualContact(false)}
                    >
                      Save contact
                    </Button>
                  )}
                </Stack>
              </Box>
            )}

            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Why selected
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {selected.whySelected || selected.scoreExplanation || selected.notes || '—'}
            </Typography>

            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
              Status
            </Typography>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
              <StatusChip
                label={`Acquisition: ${formatAcquisitionStatus(selected.acquisitionStatus) !== '—' ? formatAcquisitionStatus(selected.acquisitionStatus) : formatLifecycle(selected.crmLifecycle || selected.status)}`}
                color="info"
              />
              <StatusChip
                label={`Customer: ${formatCustomerStatus(selected.customerStatus)}`}
              />
              <StatusChip
                label={`Distribution: ${formatDistributionStatus(selected.distributionStatus)}`}
              />
              <StatusChip
                label={`Partnership: ${formatPartnershipStatus(selected.partnershipStatus)}`}
              />
            </Stack>

            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Score
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

            <Divider sx={{ my: 1.5 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Timeline
            </Typography>
            {timeline.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                No events yet
              </Typography>
            ) : (
              timeline.map((ev, i) => (
                <Typography key={i} variant="caption" display="block" color="text.secondary">
                  {ev.at ? formatDate(ev.at) : '—'} — {ev.label || ev.type || ev.note || 'event'}
                </Typography>
              ))
            )}

            <Divider sx={{ my: 1.5 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Next action
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {selectedNext.label}
            </Typography>

            {drawerQueue.length > 0 && (
              <>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  Outreach queue
                </Typography>
                {drawerQueue.map((q) => (
                  <Box key={q.queueId} sx={{ mb: 1.25, p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <StatusChip label={formatLifecycle(q.status)} />
                    <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>
                      {q.subject}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {previewText(q.bodyText, 100)}
                    </Typography>
                  </Box>
                ))}
              </>
            )}

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 3 }}>
              {showPartnership && (
                <>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() =>
                      void act('Marked interested', () =>
                        adminApiService.post(
                          `${API}/prospects/${encodeURIComponent(selected.prospectId)}/interested`,
                          {},
                        ),
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
                        adminApiService.post(
                          `${API}/prospects/${encodeURIComponent(selected.prospectId)}/convert-partner`,
                          {},
                        ),
                      )
                    }
                  >
                    Convert partner
                  </Button>
                </>
              )}
              {selected.website && (
                <Button size="small" href={selected.website} target="_blank" rel="noopener noreferrer">
                  Open website
                </Button>
              )}
            </Stack>
          </Box>
        )}
      </Drawer>

      <Dialog open={!!confirmDiscovery} onClose={() => setConfirmDiscovery(null)}>
        <DialogTitle>Discover contacts</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Discover public contact information for{' '}
            {Math.min(confirmDiscovery?.ids.length ?? 0, DISCOVERY_BATCH_MAX)} prospects? Emails
            are never invented.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDiscovery(null)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={busy}
            onClick={() => {
              const ids = confirmDiscovery?.ids ?? [];
              setConfirmDiscovery(null);
              void discoverContacts(ids);
            }}
          >
            Start discovery
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
