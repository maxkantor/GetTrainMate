import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActionBar } from './ActionBar';

const defaultBar = {
  onPass: vi.fn(),
  onInterest: vi.fn(),
  onViewProfile: vi.fn(),
  interestLoading: false,
  primaryCtaLabel: 'Train Together',
};

describe('ActionBar', () => {
  it('renders Skip, primary CTA, and View Profile actions', () => {
    render(<ActionBar {...defaultBar} />);
    expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /train together/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view profile/i })).toBeInTheDocument();
  });

  it('calls onPass when Skip is clicked', () => {
    const onPass = vi.fn();
    render(<ActionBar {...defaultBar} onPass={onPass} />);
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    expect(onPass).toHaveBeenCalledTimes(1);
  });

  it('calls onInterest when primary CTA is clicked', () => {
    const onInterest = vi.fn();
    render(<ActionBar {...defaultBar} onInterest={onInterest} />);
    fireEvent.click(screen.getByRole('button', { name: /train together/i }));
    expect(onInterest).toHaveBeenCalledTimes(1);
  });

  it('calls onViewProfile when View Profile is clicked', () => {
    const onViewProfile = vi.fn();
    render(<ActionBar {...defaultBar} onViewProfile={onViewProfile} />);
    fireEvent.click(screen.getByRole('button', { name: /view profile/i }));
    expect(onViewProfile).toHaveBeenCalledTimes(1);
  });

  it('shows and triggers rewind when available', () => {
    const onRewind = vi.fn();
    render(<ActionBar {...defaultBar} onRewind={onRewind} canRewind />);
    fireEvent.click(screen.getByRole('button', { name: /restore last skipped profile/i }));
    expect(onRewind).toHaveBeenCalledTimes(1);
  });
});
