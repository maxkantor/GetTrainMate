import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';

const mockRefreshMe = vi.fn();
const meState: {
  me: { isProfileComplete: boolean; user: { id: string } } | null;
  loading: boolean;
  error: string | null;
} = {
  me: null,
  loading: false,
  error: null,
};

vi.mock('@/hooks/useAuthContext', () => ({
  useAuthContext: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: { id: 'u1', email: 'u@test.com' },
  }),
}));

vi.mock('@/hooks/useMe', () => ({
  useMe: () => ({
    me: meState.me,
    loading: meState.loading,
    error: meState.error,
    refreshMe: mockRefreshMe,
  }),
}));

vi.mock('@/services/authService', () => ({
  authService: { getJWT: vi.fn().mockResolvedValue('token') },
}));

vi.mock('@/services/billingService', () => ({
  billingService: { grantFreeSignup: vi.fn().mockResolvedValue(undefined) },
}));

function renderRoute(initialPath = '/app') {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/app" element={<ProtectedRoute requireProfileComplete={false} />}>
          <Route index element={<div data-testid="outlet">Discover</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute app shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    meState.me = null;
    meState.loading = false;
    meState.error = null;
  });

  it('allows /app when profile is not complete (dashboard handles quick setup)', () => {
    meState.me = { isProfileComplete: false, user: { id: 'u1' } };
    renderRoute();
    expect(screen.getByTestId('outlet')).toBeInTheDocument();
    expect(screen.getByText('Discover')).toBeInTheDocument();
  });

  it('allows /app when profile is complete', () => {
    meState.me = { isProfileComplete: true, user: { id: 'u1' } };
    renderRoute();
    expect(screen.getByTestId('outlet')).toBeInTheDocument();
    expect(screen.getByText('Discover')).toBeInTheDocument();
  });

  it('does not redirect when profile fetch fails; shows warning and allows through', () => {
    meState.me = null;
    meState.error = 'Failed to load account';
    renderRoute();
    expect(screen.getByTestId('outlet')).toBeInTheDocument();
    expect(screen.getByText(/couldn't load your profile/i)).toBeInTheDocument();
  });
});
