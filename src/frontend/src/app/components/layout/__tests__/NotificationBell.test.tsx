import React from 'react';
import { render, screen } from '@testing-library/react';
import { NotificationBell } from '../NotificationBell';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// PulsingBadge is a Framer Motion component — mock it as a plain span so
// tests can assert on its content without needing the animation runtime.
jest.mock('@/app/components/animation/PulsingBadge', () => ({
  PulsingBadge: ({
    count,
    className,
  }: {
    count: number;
    className?: string;
  }) => {
    if (count === 0) return null;
    return (
      <span aria-hidden="true" className={className}>
        {count > 99 ? '99+' : count}
      </span>
    );
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NotificationBell', () => {
  it('renders a button with aria-label', () => {
    render(<NotificationBell />);
    expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
  });

  it('aria-label includes the unread count', () => {
    render(<NotificationBell count={3} />);
    expect(
      screen.getByRole('button', { name: /3 unread/i }),
    ).toBeInTheDocument();
  });

  it('aria-label shows 0 unread by default', () => {
    render(<NotificationBell />);
    expect(
      screen.getByRole('button', { name: /0 unread/i }),
    ).toBeInTheDocument();
  });

  it('does not render a badge when count is 0', () => {
    render(<NotificationBell count={0} />);
    // PulsingBadge returns null for count=0 — no badge span in the DOM
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('renders a badge with the count when count > 0', () => {
    render(<NotificationBell count={5} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders "99+" in the badge when count exceeds 99', () => {
    render(<NotificationBell count={150} />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('renders the bell icon (svg)', () => {
    const { container } = render(<NotificationBell />);
    // Lucide renders an SVG with aria-hidden
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
