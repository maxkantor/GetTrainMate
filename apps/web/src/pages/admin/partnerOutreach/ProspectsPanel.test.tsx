import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProspectsPanel } from './ProspectsPanel';

const getMock = vi.fn();
const postMock = vi.fn();

vi.mock('@/services/adminApiService', () => ({
  adminApiService: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
    put: vi.fn(),
  },
}));

const squareOne = {
  prospectId: 'sq1',
  organizationName: 'Square One Golf Performance Center',
  organizationType: 'sports_club',
  metro: 'Atlanta',
  country: 'us',
  website: 'https://squareone.example',
  contactabilityState: 'RETRY_LATER',
  contactState: 'CONTACT_NEEDED',
  acquisitionStatus: 'CONTACT_NEEDED',
  acquisitionScore: 0,
  nextAction: { key: 'RESEARCH_CONTACT', label: 'Research contact', primaryButton: 'Research contact' },
};

function sharedProps() {
  return {
    onError: vi.fn(),
    onNotice: vi.fn(),
    refreshKey: 0,
    requestRefresh: vi.fn(),
  };
}

describe('ProspectsPanel — Research contact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockImplementation(async (url: string) => {
      if (String(url).includes('/queue')) return [];
      return [squareOne];
    });
  });

  it('row Research contact posts force:true and keeps a visible result banner after reload', async () => {
    postMock.mockResolvedValueOnce({
      ok: true,
      found: false,
      prospectId: 'sq1',
      nextResearchAt: '2026-09-28T00:00:00Z',
    });

    const props = sharedProps();
    render(<ProspectsPanel {...props} />);

    await screen.findByText('Square One Golf Performance Center');
    fireEvent.click(screen.getByRole('button', { name: /^Research contact$/i }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith(
        expect.stringMatching(/prospects\/sq1\/research-contact/),
        { force: true },
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/No public email for Square One/i)).toBeInTheDocument();
    });
    expect(props.onError).toHaveBeenCalledWith(expect.stringMatching(/No public email/i));
    expect(props.onNotice).toHaveBeenLastCalledWith(null);
  });

  it('bulk Research contacts uses force:true and reports outcomes', async () => {
    postMock.mockResolvedValueOnce({
      researched: 1,
      results: [{ prospectId: 'sq1', found: true, email: 'hello@square.example', ok: true }],
    });

    const props = sharedProps();
    render(<ProspectsPanel {...props} />);

    await screen.findByText('Square One Golf Performance Center');
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[checkboxes.length - 1]);

    const bulk = await screen.findByRole('button', { name: /Research contacts \(1\)/i });
    fireEvent.click(bulk);

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith(
        expect.stringMatching(/prospects\/research-contacts/),
        expect.objectContaining({ prospectIds: ['sq1'], force: true }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/Found hello@square.example/i)).toBeInTheDocument();
    });
    expect(props.onNotice).toHaveBeenCalled();
  });

  it('renders Select all and filter controls', async () => {
    render(<ProspectsPanel {...sharedProps()} />);
    await screen.findByText('Square One Golf Performance Center');
    expect(screen.getByRole('button', { name: /Select all/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Search')).toBeInTheDocument();
    expect(screen.getAllByText('Market').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Contact').length).toBeGreaterThan(0);
  });
});