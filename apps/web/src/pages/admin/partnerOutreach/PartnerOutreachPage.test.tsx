import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PartnerOutreachPage } from './PartnerOutreachPage';

vi.mock('./AcquisitionPanel', () => ({
  AcquisitionPanel: () => <div data-testid="panel-overview">Overview panel</div>,
}));
vi.mock('./ProspectsPanel', () => ({
  ProspectsPanel: () => <div data-testid="panel-prospects">Prospects panel</div>,
}));
vi.mock('./ApprovalsPanel', () => ({
  ApprovalsPanel: () => <div data-testid="panel-approvals">Approvals panel</div>,
}));
vi.mock('./CampaignsPanel', () => ({
  CampaignsPanel: () => <div data-testid="panel-campaigns">Campaigns panel</div>,
}));
vi.mock('./InboxPanel', () => ({
  InboxPanel: () => <div data-testid="panel-inbox">Inbox panel</div>,
}));
vi.mock('./CustomersPanel', () => ({
  CustomersPanel: () => <div data-testid="panel-customers">Customers panel</div>,
}));
vi.mock('./AnalyticsPanel', () => ({
  AnalyticsPanel: () => <div data-testid="panel-analytics">Analytics panel</div>,
}));
vi.mock('./SettingsPanel', () => ({
  SettingsPanel: () => <div data-testid="panel-settings">Settings panel</div>,
}));

function renderPage(tab?: string) {
  const path = tab ? `/admin/partner-outreach?tab=${tab}` : '/admin/partner-outreach';
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PartnerOutreachPage />
    </MemoryRouter>,
  );
}

describe('PartnerOutreachPage — Customer Acquisition chrome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title and primary tabs', () => {
    renderPage();
    expect(screen.getByText('Customer Acquisition')).toBeInTheDocument();
    for (const label of [
      'Overview',
      'Prospects',
      'Approvals',
      'Campaigns',
      'Inbox',
      'Customers',
      'Analytics',
    ]) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument();
    }
  });

  it('shows Overview by default', () => {
    renderPage();
    expect(screen.getByTestId('panel-overview')).toBeInTheDocument();
  });

  it.each([
    ['Prospects', 'panel-prospects'],
    ['Approvals', 'panel-approvals'],
    ['Campaigns', 'panel-campaigns'],
    ['Inbox', 'panel-inbox'],
    ['Customers', 'panel-customers'],
    ['Analytics', 'panel-analytics'],
  ] as const)('switches to %s tab on click', (label, testId) => {
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: label }));
    expect(screen.getByTestId(testId)).toBeInTheDocument();
  });

  it('opens Settings from gear button', () => {
    renderPage();
    fireEvent.click(screen.getByLabelText('Settings'));
    expect(screen.getByTestId('panel-settings')).toBeInTheDocument();
  });

  it('honors ?tab=prospects deep link', () => {
    renderPage('prospects');
    expect(screen.getByTestId('panel-prospects')).toBeInTheDocument();
  });

  it('maps legacy ?tab=acquisition to Overview', () => {
    renderPage('acquisition');
    expect(screen.getByTestId('panel-overview')).toBeInTheDocument();
  });

  it('exposes Refresh controls', () => {
    renderPage();
    expect(screen.getByLabelText('Refresh')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Refresh/i }).length).toBeGreaterThanOrEqual(1);
  });
});