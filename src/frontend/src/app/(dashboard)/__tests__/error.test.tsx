/**
 * Tests for the Dashboard error boundary (US-04)
 *
 * The dashboard error.tsx:
 *   - Renders a Card-based error UI (not a raw div)
 *   - Shows the error message
 *   - Shows a "Reload" button
 *   - Clicking "Reload" calls unstable_retry
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import DashboardError from '@/app/(dashboard)/error';

describe('DashboardError', () => {
  it('renders the error heading', () => {
    const mockRetry = jest.fn();
    render(
      <DashboardError
        error={new Error('Something broke')}
        unstable_retry={mockRetry}
      />,
    );
    expect(screen.getByRole('heading', { name: /failed to load dashboard/i })).toBeInTheDocument();
  });

  it('shows a "Reload" button', () => {
    const mockRetry = jest.fn();
    render(
      <DashboardError
        error={new Error('Something broke')}
        unstable_retry={mockRetry}
      />,
    );
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
  });

  it('calls unstable_retry when Reload is clicked', () => {
    const mockRetry = jest.fn();
    render(
      <DashboardError
        error={new Error('Something broke')}
        unstable_retry={mockRetry}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /reload/i }));
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it('displays the error message from the thrown error', () => {
    const mockRetry = jest.fn();
    render(
      <DashboardError
        error={new Error('Custom error message for testing')}
        unstable_retry={mockRetry}
      />,
    );
    expect(screen.getByText('Custom error message for testing')).toBeInTheDocument();
  });

  it('shows digest ID when provided', () => {
    const mockRetry = jest.fn();
    const error = Object.assign(new Error('Broken'), { digest: 'abc-123' });
    render(
      <DashboardError
        error={error}
        unstable_retry={mockRetry}
      />,
    );
    expect(screen.getByText(/abc-123/)).toBeInTheDocument();
  });

  it('renders the error container with role="alert"', () => {
    const mockRetry = jest.fn();
    render(
      <DashboardError
        error={new Error('Test')}
        unstable_retry={mockRetry}
      />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('has no critical/serious axe violations', async () => {
    const mockRetry = jest.fn();
    const { container } = render(
      <DashboardError
        error={new Error('Something broke')}
        unstable_retry={mockRetry}
      />,
    );
    const results = await axe(container);
    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(critical).toHaveLength(0);
  });
});
