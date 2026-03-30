import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActionBar } from './ActionBar';

describe('ActionBar', () => {
  it('renders Skip, Train, Strong Match buttons', () => {
    render(
      <ActionBar
        onPass={vi.fn()}
        onLike={vi.fn()}
        onConnect={vi.fn()}
        likeLoading={false}
        credits={1}
        canUndo={false}
        showUndo={false}
      />
    );
    expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /train/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /strong match/i })).toBeInTheDocument();
  });

  it('calls onPass when Skip is clicked', () => {
    const onPass = vi.fn();
    render(
      <ActionBar
        onPass={onPass}
        onLike={vi.fn()}
        onConnect={vi.fn()}
        likeLoading={false}
        credits={1}
        canUndo={false}
        showUndo={false}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    expect(onPass).toHaveBeenCalledTimes(1);
  });

  it('calls onLike when Train is clicked', () => {
    const onLike = vi.fn();
    render(
      <ActionBar
        onPass={vi.fn()}
        onLike={onLike}
        onConnect={vi.fn()}
        likeLoading={false}
        credits={1}
        canUndo={false}
        showUndo={false}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /train/i }));
    expect(onLike).toHaveBeenCalledTimes(1);
  });

  it('calls onConnect when Strong Match is clicked', () => {
    const onConnect = vi.fn();
    render(
      <ActionBar
        onPass={vi.fn()}
        onLike={vi.fn()}
        onConnect={onConnect}
        likeLoading={false}
        credits={1}
        canUndo={false}
        showUndo={false}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /strong match/i }));
    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it('shows Undo when showUndo and canUndo are true', () => {
    const onUndo = vi.fn();
    render(
      <ActionBar
        onPass={vi.fn()}
        onLike={vi.fn()}
        onConnect={vi.fn()}
        onUndo={onUndo}
        likeLoading={false}
        credits={1}
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
        onPass={vi.fn()}
        onLike={vi.fn()}
        onConnect={vi.fn()}
        onUndo={onUndo}
        likeLoading={false}
        credits={1}
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
        onPass={vi.fn()}
        onLike={vi.fn()}
        onConnect={vi.fn()}
        likeLoading={false}
        credits={2}
        canUndo={false}
        showUndo={false}
      />
    );
    expect(screen.getByText(/1 credit/i)).toBeInTheDocument();
  });
});
