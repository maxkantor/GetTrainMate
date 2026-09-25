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
    awaitingApproval: 0,
    autoEligible: 3,
    drafts: 3,
  },
  conversionRates: {},
  settings: { pauseAllOutreach: false, testRecipientsOnly: false },
  todaysActions: [
    { key: 'auto_eligible', label: 'Auto eligible', count: 3, filter: 'status=draft' },
    { key: 'human_review', label: 'Human review', count: 0, filter: 'contactDiscoveryStatus=REVIEW_REQUIRED' },
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
    expect((await screen.findAllByText('Auto eligible')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Approve drafts')).not.toBeInTheDocument();
  });

  it('Auto eligible action navigates to the send queue', async () => {
    const onNavigate = vi.fn();
    render(<AcquisitionPanel {...props(onNavigate)} />);
    fireEvent.click((await screen.findAllByText('Auto eligible'))[0]);
    expect(onNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ tab: 'approvals' }),
    );
  });

  it('View queue alert navigates to send queue for auto-eligible drafts', async () => {
    const onNavigate = vi.fn();
    render(<AcquisitionPanel {...props(onNavigate)} />);
    fireEvent.click(await screen.findByRole('button', { name: /View queue/i }));
    expect(onNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ tab: 'approvals' }),
    );
  });
});
