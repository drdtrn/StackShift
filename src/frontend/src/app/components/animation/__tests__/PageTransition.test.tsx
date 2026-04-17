import React from 'react';
import { render, screen } from '@testing-library/react';
import { PageTransition } from '../PageTransition';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));

const mockUseReducedMotion = jest.fn<boolean, []>().mockReturnValue(false);

jest.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      initial: _i,
      animate: _a,
      exit: _e,
      transition: _t,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReducedMotion: () => mockUseReducedMotion(),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PageTransition', () => {
  beforeEach(() => mockUseReducedMotion.mockReturnValue(false));

  it('renders children', () => {
    render(
      <PageTransition>
        <p data-testid="child">Page content</p>
      </PageTransition>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('wraps children in a div', () => {
    const { container } = render(
      <PageTransition>
        <span data-testid="inner">content</span>
      </PageTransition>,
    );
    // The motion.div mock renders as a plain div
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.tagName).toBe('DIV');
    expect(wrapper).toContainElement(screen.getByTestId('inner'));
  });

  it('applies flex layout classes to the wrapper', () => {
    const { container } = render(
      <PageTransition>
        <span />
      </PageTransition>,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toMatch(/flex/);
    expect(wrapper.className).toMatch(/flex-col/);
    expect(wrapper.className).toMatch(/flex-1/);
  });
});

describe('PageTransition — reduced motion', () => {
  beforeEach(() => mockUseReducedMotion.mockReturnValue(true));

  it('still renders children when reduced motion is active', () => {
    render(
      <PageTransition>
        <p data-testid="child-rm">Reduced motion content</p>
      </PageTransition>,
    );
    expect(screen.getByTestId('child-rm')).toBeInTheDocument();
  });
});
