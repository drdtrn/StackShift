/**
 * Tests for the MobileDrawer component (US-05)
 *
 * The MobileDrawer:
 *   - Renders the sidebar when open=true
 *   - Does NOT render the sidebar when open=false
 *   - Has role="dialog" when open
 *   - Clicking the backdrop calls onClose
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileDrawer } from '@/app/components/layout/MobileDrawer';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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
    aside: ({
      children,
      initial: _i,
      animate: _a,
      exit: _e,
      transition: _t,
      ...props
    }: React.HTMLAttributes<HTMLElement> & Record<string, unknown>) => (
      <aside {...props}>{children}</aside>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Stub out Sidebar to keep tests simple (avoids deep mock chains)
jest.mock('@/app/components/layout/Sidebar', () => ({
  Sidebar: () => <nav data-testid="sidebar-stub">Sidebar</nav>,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MobileDrawer — visibility', () => {
  it('renders the sidebar when open=true', () => {
    render(<MobileDrawer open={true} onClose={jest.fn()} />);
    expect(screen.getByTestId('sidebar-stub')).toBeInTheDocument();
  });

  it('does NOT render the sidebar when open=false', () => {
    render(<MobileDrawer open={false} onClose={jest.fn()} />);
    expect(screen.queryByTestId('sidebar-stub')).not.toBeInTheDocument();
  });
});

describe('MobileDrawer — accessibility', () => {
  it('has role="dialog" when open', () => {
    render(<MobileDrawer open={true} onClose={jest.fn()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('MobileDrawer — interactions', () => {
  it('calls onClose when the backdrop is clicked', () => {
    const onClose = jest.fn();
    render(<MobileDrawer open={true} onClose={onClose} />);
    // The backdrop is the first motion.div with the click handler
    const backdrop = screen.getByTestId('mobile-drawer-backdrop');
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onClose when the drawer panel is clicked', () => {
    const onClose = jest.fn();
    render(<MobileDrawer open={true} onClose={onClose} />);
    const sidebar = screen.getByTestId('sidebar-stub');
    fireEvent.click(sidebar);
    expect(onClose).not.toHaveBeenCalled();
  });
});
