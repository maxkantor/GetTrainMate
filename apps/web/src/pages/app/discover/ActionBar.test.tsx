import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActionBar } from './ActionBar';

const defaultBar = {
  onPass: vi.fn(),
  onLike: vi.fn(),
  onConnect: vi.fn(),
  likeLoading: false,
  credits: 1,
  canUndo: false,
  showUndo: false,
};

describe('ActionBar', () => {
  it('renders Skip, Train, Strong Match when compatibility is high', () => {
    render(
      <ActionBar
        {...defaultBar}
        compatibilityScore={85}
      />
    );
    expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /train/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /strong match/i })).toBeInTheDocument();
  });

  it('renders Connect when score is low', () => {
    render(
      <ActionBar
        {...defaultBar}
        compatibilityScore={35}
      />
    );
    expect(screen.getByRole('button', { name: /^connect/i })).toBeInTheDocument();
  });

  it('calls onPass when Skip is clicked', () => {
    const onPass = vi.fn();
    render(
      <ActionBar
        {...defaultBar}
        onPass={onPass}
        compatibilityScore={85}
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
        compatibilityScore={85}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /train/i }));
    expect(onLike).toHaveBeenCalledTimes(1);
  });

  it('calls onConnect when Strong Match is clicked', () => {
    const onConnect = vi.fn();
    render(
      <ActionBar
        {...defaultBar}
        onConnect={onConnect}
        compatibilityScore={85}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /strong match/i }));
    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it('shows Undo when showUndo and canUndo are true', () => {
    const onUndo = vi.fn();
    render(
      <ActionBar
        {...defaultBar}
        onUndo={onUndo}
        compatibilityScore={85}
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
        compatibilityScore={85}
        canUndo={true}
        showUndo={true}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /undo/i }));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('shows 1 credit hint when credits >= 1', () => {
    render(
      <ActionBar
        {...defaultBar}
        credits={2}
        compatibilityScore={85}
      />
    );
    expect(screen.getByText(/1 credit/i)).toBeInTheDocument();
  });
});
