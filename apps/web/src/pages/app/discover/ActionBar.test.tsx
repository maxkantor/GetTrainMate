import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActionBar } from './ActionBar';

const defaultBar = {
  onPass: vi.fn(),
  onLike: vi.fn(),
  onConnect: vi.fn(),
  likeLoading: false,
  canUndo: false,
  showUndo: false,
};

describe('ActionBar', () => {
  it('renders Skip, Train, and View Profile actions', () => {
    render(
      <ActionBar
        {...defaultBar}
      />
    );
    expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /train/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view profile/i })).toBeInTheDocument();
  });

  it('calls onPass when Skip is clicked', () => {
    const onPass = vi.fn();
    render(
      <ActionBar
        {...defaultBar}
        onPass={onPass}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    expect(onPass).toHaveBeenCalledTimes(1);
  });

  it('calls onLike when Train is clicked', () => {
    const onLike = vi.fn();
    render(
      <ActionBar
        {...defaultBar}
        onLike={onLike}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /train/i }));
    expect(onLike).toHaveBeenCalledTimes(1);
  });

  it('calls onConnect when View Profile is clicked', () => {
    const onConnect = vi.fn();
    render(
      <ActionBar
        {...defaultBar}
        onConnect={onConnect}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /view profile/i }));
    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it('shows Undo when showUndo and canUndo are true', () => {
    const onUndo = vi.fn();
    render(
      <ActionBar
        {...defaultBar}
        onUndo={onUndo}
        canUndo={true}
        showUndo={true}
      />
    );
    const undoBtn = screen.getByRole('button', { name: /undo/i });
    expect(undoBtn).toBeInTheDocument();
  });

  it('calls onUndo when Undo is clicked', () => {
    const onUndo = vi.fn();
    render(
      <ActionBar
        {...defaultBar}
        onUndo={onUndo}
        canUndo={true}
        showUndo={true}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /undo/i }));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('shows and triggers rewind when available', () => {
    const onRewind = vi.fn();
    render(
      <ActionBar
        {...defaultBar}
        onRewind={onRewind}
        canRewind={true}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /restore last skipped profile/i }));
    expect(onRewind).toHaveBeenCalledTimes(1);
  });
});
