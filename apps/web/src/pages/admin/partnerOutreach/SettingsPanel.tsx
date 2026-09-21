import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import type { OutreachSettings, PanelSharedProps } from './types';
import { API, PanelSkeleton } from './components';
import { adminApiService } from '@/services/adminApiService';

/** Emergency controls + discovery limits. Normal sending is Approve & Send — no LIVE toggle. */
export const SettingsPanel: React.FC<PanelSharedProps> = ({
  onError,
  onNotice,
  refreshKey,
  requestRefresh,
}) => {
  const [settings, setSettings] = useState<OutreachSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pauseAll, setPauseAll] = useState(false);
  const [testOnly, setTestOnly] = useState(false);
  const [testRecipients, setTestRecipients] = useState('');
  const [prospectsPerRun, setProspectsPerRun] = useState(8);
  const [researchContactsPerRun, setResearchContactsPerRun] = useState(10);
  const [draftsPerRun, setDraftsPerRun] = useState(5);
  const [confirmPause, setConfirmPause] = useState(false);

  const applyLocal = (s: OutreachSettings) => {
    setSettings(s);
    setPauseAll(Boolean(s.pauseAllOutreach));
    setTestOnly(Boolean((s as OutreachSettings & { testRecipientsOnly?: boolean }).testRecipientsOnly));
    setTestRecipients((s.testRecipients || []).join(', '));
    setProspectsPerRun(s.prospectsPerRun ?? 8);
    setResearchContactsPerRun(s.researchContactsPerRun ?? 10);
    setDraftsPerRun(s.draftsPerRun ?? 5);
  };

  const load = useCallback(async () => {
    setLoading(true);
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

  const save = async (nextPause?: boolean) => {
    setSaving(true);
    onError(null);
    try {
      const recipients = testRecipients
        .split(/[,;\s]+/)
        .map((e) => e.trim())
        .filter((e) => e.includes('@'));
      const body: Record<string, unknown> = {
        pauseAllOutreach: nextPause ?? pauseAll,
        testRecipientsOnly: testOnly,
        testRecipients: recipients,
        prospectsPerRun,
        researchContactsPerRun,
        draftsPerRun,
      };
      const updated = (await adminApiService.put(`${API}/settings`, body)) as OutreachSettings;
      applyLocal(updated);
      onNotice('Settings saved');
      requestRefresh();
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Failed to save settings');
    } finally {
      setSaving(false);
      setConfirmPause(false);
    }
  };

  if (loading && !settings) return <PanelSkeleton rows={4} />;

  return (
    <Box sx={{ maxWidth: 720 }}>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
        Outreach controls
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        Normal workflow: Approvals → APPROVE &amp; SEND. You do not need Lambda flags, AWS Console,
        or a LIVE mode toggle. Admin approval authorizes SES send (subject to daily limit, pause,
        and suppression).
      </Alert>

      <Box sx={{ p: 2, border: '1px solid', borderColor: 'error.main', borderRadius: 2, mb: 3 }}>
        <Typography sx={{ fontWeight: 800, mb: 1 }}>Emergency pause</Typography>
        <FormControlLabel
          control={
            <Switch
              checked={pauseAll}
              color="error"
              onChange={(_, v) => {
                if (v) setConfirmPause(true);
                else {
                  setPauseAll(false);
                  void save(false);
                }
              }}
            />
          }
          label="PAUSE ALL OUTREACH"
        />
        <Typography variant="caption" color="text.secondary" display="block">
          Blocks all outbound partner/customer acquisition email and follow-ups until you resume.
          Discovery and research can continue.
        </Typography>
      </Box>

      <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 3 }}>
        <Typography sx={{ fontWeight: 700, mb: 1 }}>Safe testing (optional)</Typography>
        <FormControlLabel
          control={<Switch checked={testOnly} onChange={(_, v) => setTestOnly(v)} />}
          label="Test recipients only"
        />
        <TextField
          fullWidth
          size="small"
          label="Test recipients (comma-separated)"
          value={testRecipients}
          onChange={(e) => setTestRecipients(e.target.value)}
          sx={{ mt: 1 }}
          helperText="When enabled, APPROVE & SEND only delivers to these addresses."
        />
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr 1fr', mb: 2 }}>
        <TextField
          type="number"
          label="Prospects / run"
          value={prospectsPerRun}
          onChange={(e) => setProspectsPerRun(Number(e.target.value) || 0)}
        />
        <TextField
          type="number"
          label="Research / run"
          value={researchContactsPerRun}
          onChange={(e) => setResearchContactsPerRun(Number(e.target.value) || 0)}
        />
        <TextField
          type="number"
          label="Drafts / run"
          value={draftsPerRun}
          onChange={(e) => setDraftsPerRun(Number(e.target.value) || 0)}
        />
      </Box>

      <Button variant="contained" disabled={saving} onClick={() => void save()}>
        {saving ? 'Saving…' : 'Save settings'}
      </Button>

      <Dialog open={confirmPause} onClose={() => setConfirmPause(false)}>
        <DialogTitle>Pause all outreach?</DialogTitle>
        <DialogContent>
          <Typography>
            No approved emails or follow-ups will send until you turn this off. Use only for
            emergencies.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmPause(false)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              setPauseAll(true);
              void save(true);
            }}
          >
            Pause all outreach
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
