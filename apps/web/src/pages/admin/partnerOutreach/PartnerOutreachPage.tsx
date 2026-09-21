import React, { useCallback, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  IconButton,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import RefreshIcon from '@mui/icons-material/Refresh';
import type { NavigateFilters, PrimaryTab, ProspectFilters } from './types';
import { AcquisitionPanel } from './AcquisitionPanel';
import { ProspectsPanel } from './ProspectsPanel';
import { ApprovalsPanel } from './ApprovalsPanel';
import { CampaignsPanel } from './CampaignsPanel';
import { InboxPanel } from './InboxPanel';
import { AnalyticsPanel } from './AnalyticsPanel';
import { SettingsPanel } from './SettingsPanel';

const PRIMARY_TABS: { id: PrimaryTab; label: string }[] = [
  { id: 'acquisition', label: 'Acquisition' },
  { id: 'prospects', label: 'Prospects' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'analytics', label: 'Analytics' },
];

export const PartnerOutreachPage: React.FC = () => {
  const [tab, setTab] = useState<PrimaryTab>('acquisition');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [prospectFilters, setProspectFilters] = useState<ProspectFilters | undefined>();
  const [approvalsStatus, setApprovalsStatus] = useState<string | undefined>('draft');

  const requestRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const onNavigate = useCallback((nav: NavigateFilters) => {
    setTab(nav.tab);
    if (nav.prospectFilters) setProspectFilters(nav.prospectFilters);
    if (nav.approvalsStatus) setApprovalsStatus(nav.approvalsStatus);
  }, []);

  const shared = {
    onError: setError,
    onNotice: setNotice,
    refreshKey,
    requestRefresh,
  };

  const tabIndex = tab === 'settings' ? -1 : PRIMARY_TABS.findIndex((t) => t.id === tab);

  return (
    <Box sx={{ maxWidth: 1600 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          mb: 2,
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Partner Outreach
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Customer-acquisition CRM — discover partners, approve outreach, measure attributed growth.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Tooltip title="Refresh">
            <IconButton onClick={requestRefresh} aria-label="Refresh">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Settings">
            <IconButton
              color={tab === 'settings' ? 'primary' : 'default'}
              onClick={() => setTab('settings')}
              aria-label="Settings"
            >
              <SettingsIcon />
            </IconButton>
          </Tooltip>
          <Button variant="outlined" onClick={requestRefresh}>
            Refresh
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {notice && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      <Tabs
        value={tab === 'settings' ? false : Math.max(0, tabIndex)}
        onChange={(_, idx: number) => {
          const next = PRIMARY_TABS[idx]?.id;
          if (next) setTab(next);
        }}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{ mb: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}
      >
        {PRIMARY_TABS.map((t) => (
          <Tab key={t.id} label={t.label} sx={{ fontWeight: 700, letterSpacing: 0.4 }} />
        ))}
      </Tabs>

      {tab === 'acquisition' && <AcquisitionPanel {...shared} onNavigate={onNavigate} />}
      {tab === 'prospects' && (
        <ProspectsPanel {...shared} initialFilters={prospectFilters} />
      )}
      {tab === 'approvals' && (
        <ApprovalsPanel {...shared} initialStatus={approvalsStatus} />
      )}
      {tab === 'campaigns' && <CampaignsPanel {...shared} />}
      {tab === 'inbox' && <InboxPanel {...shared} />}
      {tab === 'analytics' && <AnalyticsPanel {...shared} />}
      {tab === 'settings' && <SettingsPanel {...shared} />}
    </Box>
  );
};
