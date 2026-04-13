/**
 * Tests for the Breadcrumb component (US-06)
 *
 * Verifies:
 *   - Root path renders "Overview" as current page
 *   - Nested routes render a trail with ancestor links + current span
 *   - Dynamic segments (e.g. raw IDs) fall back to the segment text
 *   - The nav landmark has an accessible label
 *   - aria-current="page" is set on the last crumb only
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { Breadcrumb } from '../Breadcrumb';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}));

jest.mock('next/link', () => {
  const MockLink = ({
    href,
    children,
    ...props
  }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  );
  MockLink.displayName = 'Link';
  return MockLink;
});

import { usePathname } from 'next/navigation';
const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>;

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Breadcrumb — root path', () => {
  it('renders "Overview" as current page for "/"', () => {
    mockUsePathname.mockReturnValue('/');
    render(<Breadcrumb />);
    const current = screen.getByText('Overview');
    expect(current).toBeInTheDocument();
    expect(current).toHaveAttribute('aria-current', 'page');
  });

  it('does not render any ancestor links on root path', () => {
    mockUsePathname.mockReturnValue('/');
    render(<Breadcrumb />);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
});

describe('Breadcrumb — top-level routes', () => {
  it('renders "Log Explorer" for "/logs"', () => {
    mockUsePathname.mockReturnValue('/logs');
    render(<Breadcrumb />);
    expect(screen.getByText('Log Explorer')).toHaveAttribute('aria-current', 'page');
  });

  it('renders "Incidents" for "/incidents"', () => {
    mockUsePathname.mockReturnValue('/incidents');
    render(<Breadcrumb />);
    expect(screen.getByText('Incidents')).toHaveAttribute('aria-current', 'page');
  });

  it('renders "Alert Rules" for "/alerts"', () => {
    mockUsePathname.mockReturnValue('/alerts');
    render(<Breadcrumb />);
    expect(screen.getByText('Alert Rules')).toHaveAttribute('aria-current', 'page');
  });
});

describe('Breadcrumb — nested routes', () => {
  it('renders ancestor link + current page for "/incidents/inc-001"', () => {
    mockUsePathname.mockReturnValue('/incidents/inc-001');
    render(<Breadcrumb />);

    // Ancestor is a link
    const ancestorLink = screen.getByRole('link', { name: 'Incidents' });
    expect(ancestorLink).toBeInTheDocument();
    expect(ancestorLink).toHaveAttribute('href', '/incidents');

    // Current page is a span, not a link
    const current = screen.getByText('inc-001');
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current.tagName).toBe('SPAN');
  });

  it('renders "New" for "/projects/new"', () => {
    mockUsePathname.mockReturnValue('/projects/new');
    render(<Breadcrumb />);

    expect(screen.getByRole('link', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.getByText('New')).toHaveAttribute('aria-current', 'page');
  });

  it('falls back to raw segment for unknown dynamic IDs', () => {
    mockUsePathname.mockReturnValue('/projects/00000000-some-uuid');
    render(<Breadcrumb />);
    expect(screen.getByText('00000000-some-uuid')).toHaveAttribute('aria-current', 'page');
  });
});

describe('Breadcrumb — accessibility', () => {
  it('has a navigation landmark with label "Breadcrumb"', () => {
    mockUsePathname.mockReturnValue('/');
    render(<Breadcrumb />);
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
  });

  it('only marks the last crumb as aria-current="page"', () => {
    mockUsePathname.mockReturnValue('/incidents/inc-001');
    render(<Breadcrumb />);
    const currentItems = document.querySelectorAll('[aria-current="page"]');
    expect(currentItems).toHaveLength(1);
    expect(currentItems[0]).toHaveTextContent('inc-001');
  });
});
