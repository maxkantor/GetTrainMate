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

describe('ProspectsPanel — contact discovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockImplementation(async (url: string) => {
      if (String(url).includes('/queue')) return [];
      if (String(url).includes('pipeline-counters')) {
        return {
          prospects: 1,
          emailsFound: 0,
          contactForms: 0,
          needContact: 1,
          readyToReview: 0,
          approved: 0,
          sentToday: 0,
          customers: 0,
        };
      }
      if (String(url).includes('contact-discovery/active')) return { active: false };
      return [squareOne];
    });
  });

  it('row Research contact posts discover-contact with force:true and keeps a visible banner', async () => {
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
        expect.stringMatching(/prospects\/sq1\/discover-contact/),
        { force: true },
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/No public email for Square One/i)).toBeInTheDocument();
    });
    expect(props.onNotice).toHaveBeenLastCalledWith(null);
  });

  it('renders Find missing contacts for prospects with a website and no email', async () => {
    render(<ProspectsPanel {...sharedProps()} />);
    await screen.findByText('Square One Golf Performance Center');
    const button = screen.getByRole('button', { name: /Find missing contacts \(1\)/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it('Find missing contacts confirms, starts a durable job and shows the progress panel', async () => {
    postMock.mockResolvedValueOnce({
      jobId: 'job-1',
      status: 'complete',
      progressPct: 100,
      total: 1,
      processed: 1,
      emailsFound: 1,
      formsFound: 0,
      reviewRequired: 0,
      noContact: 0,
      errors: 0,
      remaining: 0,
    });

    const props = sharedProps();
    render(<ProspectsPanel {...props} />);
    await screen.findByText('Square One Golf Performance Center');

    fireEvent.click(screen.getByRole('button', { name: /Find missing contacts \(1\)/i }));
    expect(
      await screen.findByText(/Find public contact information for 1 prospects\?/i),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Start discovery/i }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith(
        expect.stringMatching(/prospects\/contact-discovery\/jobs/),
        expect.objectContaining({
          prospectIds: ['sq1'],
          filterMissingOnly: true,
          max: 1,
          force: true,
        }),
      );
    });

    expect(await screen.findByText('CONTACT DISCOVERY')).toBeInTheDocument();
    expect(screen.getByText(/1 of 1 processed/i)).toBeInTheDocument();
    expect(screen.getByText(/Emails found 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Remaining 0/i)).toBeInTheDocument();
  });

  it('Find contacts for selected posts only the selected ids', async () => {
    postMock.mockResolvedValueOnce({
      jobId: 'job-2',
      status: 'complete',
      progressPct: 100,
      total: 1,
      processed: 1,
      noContact: 1,
      remaining: 0,
    });

    render(<ProspectsPanel {...sharedProps()} />);
    await screen.findByText('Square One Golf Performance Center');
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[checkboxes.length - 1]);

    fireEvent.click(await screen.findByRole('button', { name: /Find contacts for selected \(1\)/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Start discovery/i }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith(
        expect.stringMatching(/prospects\/contact-discovery\/jobs/),
        expect.objectContaining({ prospectIds: ['sq1'] }),
      );
    });
  });

  it('renders Select all and filter controls', async () => {
    render(<ProspectsPanel {...sharedProps()} />);
    await screen.findByText('Square One Golf Performance Center');
    expect(screen.getByRole('button', { name: /Select all/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Search')).toBeInTheDocument();
    expect(screen.getAllByText('Market').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Contact').length).toBeGreaterThan(0);
  });

  it('shows CONTACT PIPELINE counters and Discover more prospects', async () => {
    render(<ProspectsPanel {...sharedProps()} />);
    expect(await screen.findByText('CONTACT PIPELINE')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Discover more prospects/i })).toBeInTheDocument();
  });
});

describe('ProspectsPanel — manual contact entry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockImplementation(async (url: string) => {
      if (String(url).includes('/queue')) return [];
      if (String(url).includes('pipeline-counters')) {
        return { prospects: 1, emailsFound: 0, needContact: 1, readyToReview: 0, approved: 0, sentToday: 0, customers: 0 };
      }
      if (String(url).includes('contact-discovery/active')) return { active: false };
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

  it('opens the contact form from + Add and saves the manual contact', async () => {
    postMock.mockResolvedValueOnce({
      ok: true,
      saved: true,
      email: 'owner@square.example',
      prospect: { ...squareOne, email: 'owner@square.example', emailSource: 'manual_admin' },
    });

    render(<ProspectsPanel {...sharedProps()} />);
    await screen.findByText('Square One Golf Performance Center');
    fireEvent.click(screen.getByText('Square One Golf Performance Center'));

    fireEvent.click(await screen.findByRole('button', { name: /^\+ Add$/ }));
    fireEvent.change(await screen.findByLabelText(/^Email/i), {
      target: { value: 'owner@square.example' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Save contact$/i }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith(
        expect.stringMatching(/prospects\/sq1\/manual-contact/),
        expect.objectContaining({ email: 'owner@square.example', confirmDuplicate: false }),
      );
    });
    expect(await screen.findByText(/Saved owner@square.example/i)).toBeInTheDocument();
  });

  it('inline edit pencil opens the contact form for a prospect that already has an email', async () => {
    const withEmail = {
      ...squareOne,
      email: 'old@square.example',
      emailSource: 'manual_admin',
      contactabilityState: 'CONTACT_FOUND',
    };
    getMock.mockImplementation(async (url: string) => {
      if (String(url).includes('/queue')) return [];
      if (String(url).includes('pipeline-counters')) {
        return { prospects: 1, emailsFound: 1, needContact: 0, readyToReview: 0, approved: 0, sentToday: 0, customers: 0 };
      }
      if (String(url).includes('contact-discovery/active')) return { active: false };
      if (String(url).includes('/detail')) return { prospect: withEmail, queueItems: [], timeline: [] };
      return [withEmail];
    });
    postMock.mockResolvedValueOnce({
      ok: true,
      saved: true,
      email: 'new@square.example',
      prospect: { ...withEmail, email: 'new@square.example' },
    });

    render(<ProspectsPanel {...sharedProps()} />);
    await screen.findByText('Square One Golf Performance Center');
    fireEvent.click(screen.getByText('Square One Golf Performance Center'));
    expect(await screen.findByText('old@square.example')).toBeInTheDocument();
    const editBtns = await screen.findAllByLabelText('Edit email');
    fireEvent.click(editBtns[editBtns.length - 1]);
    fireEvent.change(await screen.findByLabelText(/^Email/i), { target: { value: 'new@square.example' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save contact$/i }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith(
        expect.stringMatching(/manual-contact/),
        expect.objectContaining({ email: 'new@square.example' }),
      );
    });
  });

  it('shows the pending review candidate with Accept / Reject', async () => {
    const pending = {
      ...squareOne,
      contactDiscoveryStatus: 'REVIEW_REQUIRED',
      pendingReviewEmail: 'maybe@square.example',
      pendingReviewConfidence: 'MEDIUM',
      pendingReviewSourceUrl: 'https://squareone.example/contact',
      lastContactResearchSummary: '2026-09-20 LiveNoEmail: checked 6 page(s).',
      lastContactResearchAt: '2026-09-20T10:00:00Z',
    };
    getMock.mockImplementation(async (url: string) => {
      if (String(url).includes('/queue')) return [];
      if (String(url).includes('pipeline-counters')) {
        return { prospects: 1, emailsFound: 0, needContact: 1, readyToReview: 0, approved: 0, sentToday: 0, customers: 0 };
      }
      if (String(url).includes('contact-discovery/active')) return { active: false };
      if (String(url).includes('/detail')) return { prospect: pending, queueItems: [], timeline: [] };
      return [pending];
    });
    postMock.mockResolvedValueOnce({ ok: true, accepted: true, email: 'maybe@square.example' });

    render(<ProspectsPanel {...sharedProps()} />);
    await screen.findByText('Square One Golf Performance Center');
    fireEvent.click(screen.getByText('Square One Golf Performance Center'));

    expect(await screen.findByText(/Review required: maybe@square.example/i)).toBeInTheDocument();
    expect(screen.getByText(/Last researched/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Accept$/i }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith(
        expect.stringMatching(/prospects\/sq1\/pending-contact\/accept/),
        {},
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

    await waitFor(() => {
      expect(postMock).toHaveBeenCalled();
    });
    expect(await screen.findByRole('button', { name: /Save anyway/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Save anyway/i }));

    await waitFor(() => {
      expect(postMock).toHaveBeenLastCalledWith(
        expect.stringMatching(/manual-contact/),
        expect.objectContaining({ confirmDuplicate: true, email: 'dup@gym.example' }),
      );
    });
  });
});
