import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CampaignsPanel } from './CampaignsPanel';
import { InboxPanel } from './InboxPanel';
import { CustomersPanel } from './CustomersPanel';
import { AnalyticsPanel } from './AnalyticsPanel';
import { SettingsPanel } from './SettingsPanel';

const getMock = vi.fn();
const postMock = vi.fn();
const putMock = vi.fn();

vi.mock('@/services/adminApiService', () => ({
  adminApiService: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
    put: (...args: unknown[]) => putMock(...args),
  },
}));

vi.mock('./components', async () => {
  const actual = await vi.importActual<typeof import('./components')>('./components');
  return {
    ...actual,
    startDiscoveryJob: vi.fn(),
    pollDiscoveryJob: vi.fn(),
    discoverySummary: () => 'Discovery done',
  };
});

function shared() {
  return {
    onError: vi.fn(),
    onNotice: vi.fn(),
    refreshKey: 0,
    requestRefresh: vi.fn(),
  };
}

describe('Customer Acquisition secondary panels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('CampaignsPanel lists campaigns and Pause action', async () => {
    getMock.mockResolvedValue([
      {
        campaignId: 'atl',
        displayName: 'Atlanta',
        status: 'active',
        language: 'en',
        country: 'US',
        market: 'Atlanta',
      },
    ]);
    render(<CampaignsPanel {...shared()} />);
    expect(await screen.findAllByText(/Atlanta/i)).not.toHaveLength(0);
    expect(screen.getByRole('button', { name: /^Pause$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Discover$/i })).toBeInTheDocument();
  });

  it('InboxPanel loads threads and category filters', async () => {
    getMock.mockImplementation(async (url: string) => {
      if (String(url).endsWith('/threads') || String(url).includes('/threads?')) {
        return [{ threadId: 't1', subject: 'Re: partnership', prospectId: 'p1' }];
      }
      if (String(url).includes('/prospects')) {
        return [{ prospectId: 'p1', organizationName: 'Fit Studio' }];
      }
      return [];
    });
    render(<InboxPanel {...shared()} />);
    expect(await screen.findByText('Fit Studio')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^All$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Needs response/i })).toBeInTheDocument();
  });

  it('CustomersPanel loads acquisition customers', async () => {
    getMock.mockResolvedValue([
      {
        customerId: 'c1',
        organizationName: 'Fit Club',
        email: 'c@fit.test',
        customerStatus: 'PAYING_CUSTOMER',
        entityType: 'ORGANIZATION',
      },
    ]);
    render(<CustomersPanel {...shared()} />);
    expect(await screen.findByText('Fit Club')).toBeInTheDocument();
    expect(screen.getByLabelText('Search')).toBeInTheDocument();
  });

  it('AnalyticsPanel loads dashboard analytics', async () => {
    getMock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes('/acquisition/dashboard')) {
        return {
          northStars: { newSignups: 1, activatedUsers: 0, payingCustomers: 0, revenueCents: 0 },
          funnel: { discovered: 5, sent: 2 },
        };
      }
      if (u.includes('/metrics')) return {};
      if (u.includes('/prospects')) return [];
      if (u.includes('/campaigns')) return [];
      return {};
    });
    render(<AnalyticsPanel {...shared()} />);
    await waitFor(() => {
      expect(getMock).toHaveBeenCalled();
    });
    expect(await screen.findByText('New signups')).toBeInTheDocument();
  });

  it('SettingsPanel loads and can save', async () => {
    getMock.mockResolvedValue({
      dailyLimit: 10,
      pauseAllOutreach: false,
      testRecipientsOnly: true,
      testRecipients: ['a@test.com'],
      prospectsPerRun: 8,
      researchContactsPerRun: 10,
      draftsPerRun: 5,
    });
    putMock.mockResolvedValue({
      dailyLimit: 10,
      pauseAllOutreach: false,
      testRecipientsOnly: true,
      testRecipients: ['a@test.com'],
      prospectsPerRun: 8,
      researchContactsPerRun: 10,
      draftsPerRun: 5,
    });
    const props = shared();
    render(<SettingsPanel {...props} />);
    expect(await screen.findByText(/Outreach controls/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Save settings/i }));
    await waitFor(() => {
      expect(putMock).toHaveBeenCalled();
    });
    expect(props.onNotice).toHaveBeenCalledWith('Settings saved');
  });
});
