/**
 * Tests for the Sidebar component (US-05)
 *
 * The Sidebar:
 *   - Renders all 6 nav items with correct labels
 *   - Highlights the active route with accent colour and aria-current="page"
 *   - Shows real org name
 *   - Logo links to /
 *   - Expanded: shows labels alongside icons
 *   - Collapsed: hides labels, shows icons only
 *   - Shows collapse toggle button on desktop (isMobile=false)
 *   - Hides collapse toggle button on mobile (isMobile=true)
 *   - Clicking collapse toggle calls onToggle
 *   - Nav links have aria-current="page" for active route only
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '@/app/components/layout/Sidebar';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// jsdom doesn't implement window.matchMedia; stub it out so the Sidebar's
// lazy useState initialiser doesn't throw.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

const mockPathname = jest.fn<string, []>(() => '/');

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

jest.mock('next/link', () => {
  const MockLink = ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  );
  MockLink.displayName = 'Link';
  return MockLink;
});

jest.mock('@/app/hooks/queries/use-organization', () => ({
  useCurrentOrganization: () => ({
    data: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Real Org',
      slug: 'real-org',
      logoUrl: null,
      plan: 'team',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  }),
}));

jest.mock('@/app/hooks/useSignOut', () => ({
  useSignOut: () => ({ signOut: jest.fn(), isLoading: false }),
}));

jest.mock('@/app/components/ui/Dropdown', () => ({
  Dropdown: ({ trigger }: { trigger: React.ReactNode }) => <div>{trigger}</div>,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultProps = {
  collapsed: false,
  onToggle: jest.fn(),
};

function renderSidebar(props: Partial<typeof defaultProps & { isMobile: boolean; onNavClick: () => void }> = {}) {
  return render(<Sidebar {...defaultProps} {...props} />);
}

beforeEach(() => {
  mockPathname.mockReturnValue('/');
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Nav items
// ---------------------------------------------------------------------------

describe('Sidebar — nav items', () => {
  it('renders all 6 nav item labels when expanded', () => {
    renderSidebar({ collapsed: false });
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Log Explorer')).toBeInTheDocument();
    expect(screen.getByText('Incidents')).toBeInTheDocument();
    expect(screen.getByText('Alert Rules')).toBeInTheDocument();
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('hides labels when collapsed', () => {
    renderSidebar({ collapsed: true });
    expect(screen.queryByText('Overview')).not.toBeInTheDocument();
    expect(screen.queryByText('Log Explorer')).not.toBeInTheDocument();
    expect(screen.queryByText('Incidents')).not.toBeInTheDocument();
  });

  it('renders nav links as anchor elements', () => {
    renderSidebar();
    const overviewLink = screen.getByRole('link', { name: /overview/i });
    expect(overviewLink).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Active route highlighting
// ---------------------------------------------------------------------------

describe('Sidebar — active route', () => {
  it('marks the Overview link as active on /', () => {
    mockPathname.mockReturnValue('/');
    renderSidebar();
    const overviewLink = screen.getByRole('link', { name: /overview/i });
    expect(overviewLink).toHaveAttribute('aria-current', 'page');
  });

  it('marks the Incidents link as active on /incidents', () => {
    mockPathname.mockReturnValue('/incidents');
    renderSidebar();
    // Find by href attribute
    const incidentsLink = screen.getByRole('link', { name: /incidents/i });
    expect(incidentsLink).toHaveAttribute('aria-current', 'page');
  });

  it('marks Incidents as active on a sub-route /incidents/inc-001', () => {
    mockPathname.mockReturnValue('/incidents/inc-001');
    renderSidebar();
    const incidentsLink = screen.getByRole('link', { name: /incidents/i });
    expect(incidentsLink).toHaveAttribute('aria-current', 'page');
  });

  it('does NOT mark Overview as active on /incidents', () => {
    mockPathname.mockReturnValue('/incidents');
    renderSidebar();
    // No link with href="/" should have aria-current=page on /incidents
    const links = screen.getAllByRole('link');
    const overviewNavLink = links.find(
      (l) => l.getAttribute('href') === '/' && l.getAttribute('aria-current') === 'page',
    );
    expect(overviewNavLink).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Org name
// ---------------------------------------------------------------------------

describe('Sidebar — organisation name', () => {
  it('displays the org name from current organization data', () => {
    renderSidebar({ collapsed: false });
    expect(screen.getByText('Real Org')).toBeInTheDocument();
  });

  it('hides org name when collapsed', () => {
    renderSidebar({ collapsed: true });
    expect(screen.queryByText('Real Org')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Logo
// ---------------------------------------------------------------------------

describe('Sidebar — logo', () => {
  it('renders the StackSift icon image', () => {
    renderSidebar();
    expect(screen.getByAltText('StackSift logo')).toBeInTheDocument();
  });

  it('shows StackSift wordmark image when expanded', () => {
    renderSidebar({ collapsed: false });
    expect(screen.getByAltText('StackSift wordmark')).toBeInTheDocument();
  });

  it('hides StackSift wordmark image when collapsed', () => {
    renderSidebar({ collapsed: true });
    expect(screen.queryByAltText('StackSift wordmark')).not.toBeInTheDocument();
  });

  it('logo link navigates to home', () => {
    renderSidebar();
    expect(screen.getByRole('link', { name: /stacksift home/i })).toHaveAttribute('href', '/');
  });
});

// ---------------------------------------------------------------------------
// Collapse toggle
// ---------------------------------------------------------------------------

describe('Sidebar — collapse toggle', () => {
  it('shows the collapse toggle on desktop (isMobile=false)', () => {
    renderSidebar({ isMobile: false });
    expect(screen.getByRole('button', { name: /collapse sidebar/i })).toBeInTheDocument();
  });

  it('hides the collapse toggle on mobile (isMobile=true)', () => {
    renderSidebar({ isMobile: true });
    expect(screen.queryByRole('button', { name: /collapse sidebar/i })).not.toBeInTheDocument();
  });

  it('shows "Expand sidebar" label when already collapsed', () => {
    renderSidebar({ collapsed: true, isMobile: false });
    expect(screen.getByRole('button', { name: /expand sidebar/i })).toBeInTheDocument();
  });

  it('calls onToggle when collapse button is clicked', () => {
    const onToggle = jest.fn();
    renderSidebar({ onToggle, isMobile: false });
    fireEvent.click(screen.getByRole('button', { name: /collapse sidebar/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// onNavClick
// ---------------------------------------------------------------------------

describe('Sidebar — onNavClick', () => {
  it('calls onNavClick when a nav link is clicked', () => {
    const onNavClick = jest.fn();
    mockPathname.mockReturnValue('/');
    renderSidebar({ collapsed: false, onNavClick });
    fireEvent.click(screen.getByText('Log Explorer'));
    expect(onNavClick).toHaveBeenCalledTimes(1);
  });
});
