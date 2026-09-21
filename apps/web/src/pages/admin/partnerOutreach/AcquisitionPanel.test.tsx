import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AcquisitionPanel } from './AcquisitionPanel';

const getMock = vi.fn();
const postMock = vi.fn();

vi.mock('@/services/adminApiService', () => ({
  adminApiService: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
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

const dashboard = {
  northStars: { newSignups: 2, activatedUsers: 1, payingCustomers: 0, creditPurchases: 0, revenueCents: 0 },
  funnel: {
    discovered: 10,
    contactable: 4,
    approved: 2,
    sent: 1,
    signedUp: 2,
    activated: 1,
    buyers: 0,
    revenue: 0,
    awaitingApproval: 3,
    drafts: 3,
  },
  conversionRates: {},
  settings: { pauseAllOutreach: false, testRecipientsOnly: false },
  todaysActions: [
    { key: 'need_contact_research', label: 'Research contacts', count: 5, filter: 'acquisitionStatus=CONTACT_NEEDED' },
    { key: 'awaiting_approval', label: 'Approve drafts', count: 3, filter: 'status=draft' },
  ],
};

function props(onNavigate = vi.fn()) {
  return {
    onError: vi.fn(),
    onNotice: vi.fn(),
    refreshKey: 0,
    requestRefresh: vi.fn(),
    onNavigate,
  };
}

describe('AcquisitionPanel — Overview links', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockResolvedValue(dashboard);
  });

  it('loads Overview metrics and primary actions', async () => {
    render(<AcquisitionPanel {...props()} />);
    expect(await screen.findByText('Research contacts')).toBeInTheDocument();
    expect(screen.getByText('Approve drafts')).toBeInTheDocument();
  });

  it('Research contacts action navigates to Prospects with needed filter', async () => {
    const onNavigate = vi.fn();
    render(<AcquisitionPanel {...props(onNavigate)} />);
    fireEvent.click(await screen.findByText('Research contacts'));
    expect(onNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        tab: 'prospects',
        prospectFilters: expect.objectContaining({ contactAvailable: 'needed' }),
      }),
    );
  });

  it('Approve drafts action navigates to Approvals', async () => {
    const onNavigate = vi.fn();
    render(<AcquisitionPanel {...props(onNavigate)} />);
    fireEvent.click(await screen.findByText('Approve drafts'));
    expect(onNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ tab: 'approvals' }),
    );
  });

  it('View queue alert navigates to Approvals when approved ready', async () => {
    const onNavigate = vi.fn();
    render(<AcquisitionPanel {...props(onNavigate)} />);
    fireEvent.click(await screen.findByRole('button', { name: /View queue/i }));
    expect(onNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ tab: 'approvals', approvalsStatus: 'approved' }),
    );
  });
});
