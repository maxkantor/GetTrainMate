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

describe('ProspectsPanel — manual contact entry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockImplementation(async (url: string) => {
      if (String(url).includes('/queue')) return [];
      if (String(url).includes('/detail')) {
        return { prospect: squareOne, nextAction: squareOne.nextAction, queueItems: [], timeline: [] };
      }
      return [squareOne];
    });
  });

  it('opens Enter contact manually form in the drawer and saves', async () => {
    postMock.mockResolvedValueOnce({
      ok: true,
      saved: true,
      email: 'manager@square.example',
      emailSource: 'manual_admin',
      prospect: {
        ...squareOne,
        email: 'manager@square.example',
        emailSource: 'manual_admin',
        contactSourceType: 'MANUAL_ADMIN',
        emailVerificationStatus: 'manual_unverified',
        contactabilityState: 'CONTACT_FOUND',
        acquisitionStatus: 'CONTACTABLE',
        contactName: 'Pat',
      },
      nextAction: { key: 'CREATE_OUTREACH', label: 'Create outreach', primaryButton: 'Create draft' },
    });

    const props = sharedProps();
    render(<ProspectsPanel {...props} />);
    await screen.findByText('Square One Golf Performance Center');
    fireEvent.click(screen.getByText('Square One Golf Performance Center'));

    expect(await screen.findByRole('button', { name: /Enter contact manually/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Enter contact manually/i }));

    const emailField = await screen.findByLabelText(/^Email/i);
    fireEvent.change(emailField, { target: { value: 'Manager@Square.Example' } });
    fireEvent.change(screen.getByLabelText(/Contact name/i), { target: { value: 'Pat' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save contact$/i }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith(
        expect.stringMatching(/prospects\/sq1\/manual-contact/),
        expect.objectContaining({
          email: 'manager@square.example',
          contactName: 'Pat',
          confirmDuplicate: false,
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/Saved manager@square.example/i)).toBeInTheDocument();
    });
    expect(props.onNotice).toHaveBeenCalled();
  });

  it('validates email before posting', async () => {
    render(<ProspectsPanel {...sharedProps()} />);
    await screen.findByText('Square One Golf Performance Center');
    fireEvent.click(screen.getByText('Square One Golf Performance Center'));
    fireEvent.click(await screen.findByRole('button', { name: /Enter contact manually/i }));
    fireEvent.change(await screen.findByLabelText(/^Email/i), { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save contact$/i }));

    await waitFor(() => {
      expect(screen.getByText(/valid email/i)).toBeInTheDocument();
    });
    expect(postMock).not.toHaveBeenCalled();
  });

  it('inline edit pencil opens email-only save and posts manual-contact', async () => {
    postMock.mockResolvedValueOnce({
      ok: true,
      saved: true,
      email: 'new@square.example',
      prospect: { ...squareOne, email: 'new@square.example', emailSource: 'manual_admin' },
      nextAction: { key: 'CREATE_OUTREACH', label: 'Create outreach', primaryButton: 'Create draft' },
    });

    render(<ProspectsPanel {...sharedProps()} />);
    await screen.findByText('Square One Golf Performance Center');
    fireEvent.click(screen.getByText('Square One Golf Performance Center'));
    fireEvent.click(await screen.findByLabelText('Edit email'));
    fireEvent.change(await screen.findByLabelText(/^Email/i), { target: { value: 'new@square.example' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith(
        expect.stringMatching(/manual-contact/),
        expect.objectContaining({ email: 'new@square.example' }),
      );
    });
  });

  it('shows duplicate warning and allows Save anyway', async () => {
    postMock
      .mockResolvedValueOnce({
        ok: false,
        needsConfirm: true,
        message: 'Email already on prospect Body Awareness Studio.',
        duplicate: { type: 'prospect', organizationName: 'Body Awareness Studio' },
      })
      .mockResolvedValueOnce({
        ok: true,
        saved: true,
        email: 'dup@gym.example',
        prospect: { ...squareOne, email: 'dup@gym.example' },
        nextAction: { key: 'CREATE_OUTREACH', label: 'Create outreach', primaryButton: 'Create draft' },
      });

    render(<ProspectsPanel {...sharedProps()} />);
    await screen.findByText('Square One Golf Performance Center');
    fireEvent.click(screen.getByText('Square One Golf Performance Center'));
    fireEvent.click(await screen.findByRole('button', { name: /Enter contact manually/i }));
    fireEvent.change(await screen.findByLabelText(/^Email/i), { target: { value: 'dup@gym.example' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save contact$/i }));

    expect(await screen.findByText(/already on prospect Body Awareness Studio/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Save anyway/i }));

    await waitFor(() => {
      expect(postMock).toHaveBeenLastCalledWith(
        expect.stringMatching(/manual-contact/),
        expect.objectContaining({ confirmDuplicate: true, email: 'dup@gym.example' }),
      );
    });
  });
});
