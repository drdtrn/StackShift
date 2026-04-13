/**
 * Tests for the ThemeToggle component (US-06)
 *
 * Verifies:
 *   - Button is in the document after mount
 *   - Clicking cycles theme: dark → light → system → dark
 *   - aria-label describes the *next* action
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from '../ThemeToggle';
import { useUIStore } from '@/app/hooks/useUIStore';

beforeEach(() => {
  useUIStore.setState({ theme: 'dark' });
});

describe('ThemeToggle — rendering', () => {
  it('renders a button', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('button', { name: /switch to light/i })).toBeInTheDocument();
  });
});

describe('ThemeToggle — cycling', () => {
  it('cycles dark → light when clicked', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole('button', { name: /switch to light/i }));
    expect(useUIStore.getState().theme).toBe('light');
  });

  it('cycles light → system when clicked', async () => {
    useUIStore.setState({ theme: 'light' });
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole('button', { name: /switch to system/i }));
    expect(useUIStore.getState().theme).toBe('system');
  });

  it('cycles system → dark when clicked', async () => {
    useUIStore.setState({ theme: 'system' });
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole('button', { name: /switch to dark/i }));
    expect(useUIStore.getState().theme).toBe('dark');
  });

  it('full cycle returns to original theme after 3 clicks', async () => {
    const user = userEvent.setup();
    useUIStore.setState({ theme: 'dark' });
    render(<ThemeToggle />);

    await user.click(screen.getByRole('button', { name: /switch to light/i }));
    await user.click(screen.getByRole('button', { name: /switch to system/i }));
    await user.click(screen.getByRole('button', { name: /switch to dark/i }));

    expect(useUIStore.getState().theme).toBe('dark');
  });
});

describe('ThemeToggle — aria-label', () => {
  it('has aria-label describing the next action when in dark mode', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('button', { name: /switch to light mode/i }))
      .toHaveAttribute('aria-label', 'Switch to light mode');
  });
});
