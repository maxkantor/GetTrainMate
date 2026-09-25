import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApprovalsPanel } from './ApprovalsPanel';

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

const draft = {
  queueId: 'q1',
  prospectId: 'p1',
  organizationName: 'Body Awareness Studio',
  recipient: 'hello@body.example',
  subject: 'Help members find partners',
  bodyText: 'Hi there',
  status: 'draft',
  followUpNumber: 0,
};

function props() {
  return {
    onError: vi.fn(),
    onNotice: vi.fn(),
    refreshKey: 0,
    requestRefresh: vi.fn(),
  };
}

describe('ApprovalsPanel — tabs and send controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes('/settings')) return { dailyLimit: 10, pauseAllOutreach: false };
      if (u.includes('/acquisition/dashboard')) return { settings: { dailyLimit: 10, sentToday: 1 } };
      if (u.includes('/queue')) return [draft];
      return {};
    });
  });

  it('renders Ready / Sent / Held tabs and SEND control', async () => {
    render(<ApprovalsPanel {...props()} />);
    await screen.findByText('Body Awareness Studio');
    expect(screen.getByRole('button', { name: /Ready — Auto \(1\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sent \(/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Held \(/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^SEND 1$/i })).toBeInTheDocument();
  });

  it('opens confirm dialog when SEND is clicked', async () => {
    render(<ApprovalsPanel {...props()} />);
    await screen.findByText('Body Awareness Studio');
    fireEvent.click(screen.getByRole('button', { name: /^SEND 1$/i }));
    expect(await screen.findByText(/Send 1 email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /SEND NOW/i })).toBeInTheDocument();
  });

  it('row Send posts approve-and-send and shows sticky result (not wiped by reload)', async () => {
    postMock.mockResolvedValueOnce({ sent: true });
    render(<ApprovalsPanel {...props()} />);
    await screen.findByText('Body Awareness Studio');
    fireEvent.click(screen.getByRole('button', { name: /^Send$/i }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith(
        expect.stringMatching(/queue\/q1\/approve-and-send/),
        expect.objectContaining({ confirm: true }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Sent')).toBeInTheDocument();
    });
  });
});
