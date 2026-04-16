import React from 'react';
import { render, screen } from '@testing-library/react';
import { PulsingBadge } from '../PulsingBadge';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUseReducedMotion = jest.fn<boolean, []>().mockReturnValue(false);

jest.mock('framer-motion', () => ({
  motion: {
    span: ({
      children,
      animate: _a,
      transition: _t,
      ...props
    }: React.HTMLAttributes<HTMLSpanElement> & Record<string, unknown>) => (
      <span {...props}>{children}</span>
    ),
  },
  useReducedMotion: () => mockUseReducedMotion(),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PulsingBadge', () => {
  beforeEach(() => mockUseReducedMotion.mockReturnValue(false));

  it('renders the count when count > 0', () => {
    render(<PulsingBadge count={5} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders "99+" when count exceeds 99', () => {
    render(<PulsingBadge count={120} />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('renders nothing when count is 0', () => {
    const { container } = render(<PulsingBadge count={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('has aria-hidden="true" on the badge span', () => {
    render(<PulsingBadge count={3} />);
    const badge = screen.getByText('3');
    expect(badge).toHaveAttribute('aria-hidden', 'true');
  });

  it('accepts a custom className', () => {
    render(<PulsingBadge count={1} className="absolute -top-0.5" />);
    const badge = screen.getByText('1');
    expect(badge.className).toMatch(/absolute/);
  });

  it('renders the boundary value of 99 without "+"', () => {
    render(<PulsingBadge count={99} />);
    expect(screen.getByText('99')).toBeInTheDocument();
  });
});

describe('PulsingBadge — reduced motion', () => {
  beforeEach(() => mockUseReducedMotion.mockReturnValue(true));

  it('still renders the badge when reduced motion is active', () => {
    render(<PulsingBadge count={2} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('still hides badge when count is 0 under reduced motion', () => {
    const { container } = render(<PulsingBadge count={0} />);
    expect(container.firstChild).toBeNull();
  });
});
