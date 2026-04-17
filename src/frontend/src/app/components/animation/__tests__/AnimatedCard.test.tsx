import React from 'react';
import { render, screen } from '@testing-library/react';
import { AnimatedCard } from '../AnimatedCard';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUseReducedMotion = jest.fn<boolean, []>().mockReturnValue(false);

jest.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      initial: _i,
      animate: _a,
      exit: _e,
      transition: _t,
      whileHover: _wh,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>) => (
      <div {...props}>{children}</div>
    ),
  },
  useReducedMotion: () => mockUseReducedMotion(),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AnimatedCard', () => {
  beforeEach(() => mockUseReducedMotion.mockReturnValue(false));

  it('renders children', () => {
    render(
      <AnimatedCard>
        <p data-testid="content">Card content</p>
      </AnimatedCard>,
    );
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('applies base card styling', () => {
    const { container } = render(<AnimatedCard>content</AnimatedCard>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toMatch(/rounded-lg/);
    expect(card.className).toMatch(/border/);
    expect(card.className).toMatch(/overflow-hidden/);
  });

  it('accepts and merges a custom className', () => {
    const { container } = render(
      <AnimatedCard className="p-4 custom-class">content</AnimatedCard>,
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toMatch(/custom-class/);
    // Base classes still present
    expect(card.className).toMatch(/rounded-lg/);
  });

  it('passes through HTML div attributes', () => {
    render(
      <AnimatedCard data-testid="animated-card" role="article">
        content
      </AnimatedCard>,
    );
    const card = screen.getByTestId('animated-card');
    expect(card).toHaveAttribute('role', 'article');
  });
});

describe('AnimatedCard — reduced motion', () => {
  beforeEach(() => mockUseReducedMotion.mockReturnValue(true));

  it('still renders children when reduced motion is active', () => {
    render(
      <AnimatedCard>
        <span data-testid="rm-child">content</span>
      </AnimatedCard>,
    );
    expect(screen.getByTestId('rm-child')).toBeInTheDocument();
  });
});
