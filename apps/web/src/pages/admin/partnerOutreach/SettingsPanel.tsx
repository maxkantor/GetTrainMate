import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import type { OutreachMode, OutreachSettings, PanelSharedProps } from './types';
import { API, PanelSkeleton } from './components';
import { adminApiService } from '@/services/adminApiService';

export const SettingsPanel: React.FC<PanelSharedProps> = ({
  onError,
  onNotice,
  refreshKey,
  requestRefresh,
}) => {
  const [settings, setSettings] = useState<OutreachSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<OutreachMode>('off');
  const [pauseAll, setPauseAll] = useState(false);
  const [testRecipients, setTestRecipients] = useState('');
  const [prospectsPerRun, setProspectsPerRun] = useState(8);
  const [researchAttemptsPerRun, setResearchAttemptsPerRun] = useState(15);
  const [researchContactsPerRun, setResearchContactsPerRun] = useState(10);
  const [draftsPerRun, setDraftsPerRun] = useState(5);
  const [confirmLive, setConfirmLive] = useState(false);
  const [pendingMode, setPendingMode] = useState<OutreachMode | null>(null);

  const applyLocal = (s: OutreachSettings) => {
    setSettings(s);
    setMode((s.outreachMode || 'off').toLowerCase() as OutreachMode);
    setPauseAll(Boolean(s.pauseAllOutreach));
    setTestRecipients((s.testRecipients || []).join(', '));
    setProspectsPerRun(s.prospectsPerRun ?? 8);
    setResearchAttemptsPerRun(s.researchAttemptsPerRun ?? 15);
    setResearchContactsPerRun(s.researchContactsPerRun ?? 10);
    setDraftsPerRun(s.draftsPerRun ?? 5);
  };

  const load = useCallback(async () => {
    setLoading(true);
    onError(null);
    try {
      const s = (await adminApiService.get(`${API}/settings`)) as OutreachSettings;
      applyLocal(s);
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const save = async (nextMode?: OutreachMode) => {
    setSaving(true);
    onError(null);
    try {
      const recipients = testRecipients
        .split(/[,;\s]+/)
        .map((e) => e.trim())
        .filter((e) => e.includes('@'));
      const body: Record<string, unknown> = {
        outreachMode: nextMode ?? mode,
        pauseAllOutreach: pauseAll,
        testRecipients: recipients,
        prospectsPerRun,
        researchAttemptsPerRun,
        draftsPerRun,
      };
      if (settings?.researchContactsPerRun != null || researchContactsPerRun != null) {
        body.researchContactsPerRun = researchContactsPerRun;
      }
      const updated = (await adminApiService.put(`${API}/settings`, body)) as OutreachSettings;
      applyLocal(updated);
      onNotice('Settings saved');
      requestRefresh();
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Failed to save settings');
    } finally {
      setSaving(false);
      setConfirmLive(false);
      setPendingMode(null);
    }
  };

  const onModeChange = (next: OutreachMode) => {
    if (next === 'live' && mode !== 'live') {
      setPendingMode(next);
      setConfirmLive(true);
      return;
    }
    setMode(next);
  };

  if (loading && !settings) return <PanelSkeleton rows={5} />;

  const showResearchContacts =
    settings != null && Object.prototype.hasOwnProperty.call(settings, 'researchContactsPerRun');

  return (
    <Box sx={{ maxWidth: 560 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        Outreach settings
      </Typography>

      {settings?.complaintPause && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Complaint pause is active. Sending remains blocked until cleared server-side.
        </Alert>
      )}
      {settings?.sendEnabled === false && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Send gate is disabled in API configuration.
        </Alert>
      )}

      <FormControl fullWidth size="small" sx={{ mb: 1 }}>
        <InputLabel>Outreach mode</InputLabel>
        <Select
          label="Outreach mode"
          value={mode}
          onChange={(e) => onModeChange(e.target.value as OutreachMode)}
        >
          <MenuItem value="off">OFF</MenuItem>
          <MenuItem value="test">TEST</MenuItem>
          <MenuItem value="live">LIVE</MenuItem>
        </Select>
      </FormControl>

      <Box sx={{ mb: 2, display: 'grid', gap: 0.75 }}>
        <Alert severity={mode === 'off' ? 'warning' : 'info'} sx={{ py: 0.75 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            OFF
          </Typography>
          <Typography variant="caption" display="block">
            No external email. Discovery, research, drafts, and approvals still work; sending is blocked.
          </Typography>
        </Alert>
        <Alert severity={mode === 'test' ? 'info' : 'info'} sx={{ py: 0.75, opacity: mode === 'test' ? 1 : 0.85 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            TEST
          </Typography>
          <Typography variant="caption" display="block">
            Only configured internal test recipients may receive approved outreach.
          </Typography>
        </Alert>
        <Alert severity={mode === 'live' ? 'success' : 'info'} sx={{ py: 0.75, opacity: mode === 'live' ? 1 : 0.85 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            LIVE
          </Typography>
          <Typography variant="caption" display="block">
            Approved recipients may be contacted via SES. Recipient-level approval is still required — LIVE does not bypass Approve.
          </Typography>
        </Alert>
      </Box>

      <FormControlLabel
        control={<Switch checked={pauseAll} onChange={(e) => setPauseAll(e.target.checked)} />}
        label="Pause all outreach"
        sx={{ mb: 2, display: 'flex' }}
      />

      <TextField
        fullWidth
        size="small"
        label="Test recipients"
        helperText="Comma-separated emails used when mode is TEST"
        value={testRecipients}
        onChange={(e) => setTestRecipients(e.target.value)}
        sx={{ mb: 2 }}
      />

      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        Discovery limits per run
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: showResearchContacts ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr',
          mb: 2,
        }}
      >
        <TextField
          size="small"
          type="number"
          label="Prospects"
          value={prospectsPerRun}
          onChange={(e) => setProspectsPerRun(Number(e.target.value) || 0)}
        />
        <TextField
          size="small"
          type="number"
          label="Research attempts"
          value={researchAttemptsPerRun}
          onChange={(e) => setResearchAttemptsPerRun(Number(e.target.value) || 0)}
        />
        {showResearchContacts && (
          <TextField
            size="small"
            type="number"
            label="Research contacts"
            value={researchContactsPerRun}
            onChange={(e) => setResearchContactsPerRun(Number(e.target.value) || 0)}
            helperText="ResearchContactsPerRun"
          />
        )}
        <TextField
          size="small"
          type="number"
          label="Drafts"
          value={draftsPerRun}
          onChange={(e) => setDraftsPerRun(Number(e.target.value) || 0)}
        />
      </Box>

      {(settings?.sentCount != null || settings?.replyCount != null) && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
          Counters — sent: {settings.sentCount ?? 0}, replies: {settings.replyCount ?? 0}, bounces:{' '}
          {settings.bounceCount ?? 0}, complaints: {settings.complaintCount ?? 0}
        </Typography>
      )}

      <Button variant="contained" disabled={saving} onClick={() => void save()}>
        {saving ? 'Saving…' : 'Save settings'}
      </Button>

      <Dialog open={confirmLive} onClose={() => { setConfirmLive(false); setPendingMode(null); }}>
        <DialogTitle>Switch to LIVE mode?</DialogTitle>
        <DialogContent>
          <Typography>
            LIVE enables SES sending to approved recipients. Recipient-level approval is still required. Confirm only if you intend to send external partner outreach via SES.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setConfirmLive(false); setPendingMode(null); }}>Cancel</Button>
          <Button
            color="warning"
            variant="contained"
            disabled={saving}
            onClick={() => {
              if (pendingMode) setMode(pendingMode);
              void save(pendingMode || 'live');
            }}
          >
            Confirm LIVE
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
