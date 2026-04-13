/**
 * Tests for the AppShell component (US-06)
 *
 * The AppShell:
 *   - Renders children in a <main> element
 *   - Renders the TopBar
 *   - Renders the Sidebar (desktop)
 *   - Renders the MobileDrawer
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { AppShell } from '@/app/components/layout/AppShell';

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
      layout: _l,
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

jest.mock('@/app/components/layout/Sidebar', () => ({
  Sidebar: () => <nav data-testid="sidebar">Sidebar</nav>,
}));

jest.mock('@/app/components/layout/TopBar', () => ({
  TopBar: () => <div data-testid="topbar">TopBar</div>,
}));

jest.mock('@/app/components/layout/MobileDrawer', () => ({
  MobileDrawer: ({ open }: { open: boolean }) => (
    <div data-testid="mobile-drawer" data-open={String(open)} />
  ),
}));

jest.mock('@/app/hooks/useUIStore', () => ({
  useUIStore: () => ({
    sidebarCollapsed: false,
    mobileDrawerOpen: false,
    toggleSidebar: jest.fn(),
    toggleMobileDrawer: jest.fn(),
    setMobileDrawerOpen: jest.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AppShell — children', () => {
  it('renders children inside a <main> element', () => {
    render(
      <AppShell>
        <p data-testid="child-content">Hello World</p>
      </AppShell>,
    );
    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });

  it('the <main> element contains the children', () => {
    render(
      <AppShell>
        <span data-testid="inner">content</span>
      </AppShell>,
    );
    const main = screen.getByRole('main');
    expect(main).toContainElement(screen.getByTestId('inner'));
  });
});

describe('AppShell — layout components', () => {
  it('renders the Sidebar', () => {
    render(<AppShell><div /></AppShell>);
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });

  it('renders the TopBar', () => {
    render(<AppShell><div /></AppShell>);
    expect(screen.getByTestId('topbar')).toBeInTheDocument();
  });

  it('renders the MobileDrawer', () => {
    render(<AppShell><div /></AppShell>);
    expect(screen.getByTestId('mobile-drawer')).toBeInTheDocument();
  });

  it('passes mobileDrawerOpen state to MobileDrawer', () => {
    render(<AppShell><div /></AppShell>);
    const drawer = screen.getByTestId('mobile-drawer');
    expect(drawer).toHaveAttribute('data-open', 'false');
  });
});
