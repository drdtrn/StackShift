/**
 * Tests for the TopBar component (US-06)
 *
 * Verifies:
 *   - All sub-components are rendered
 *   - Hamburger button is present (mobile)
 *   - Hamburger click calls toggleMobileDrawer
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TopBar } from '../TopBar';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock sub-components — TopBar tests composition, not their internals
jest.mock('../Breadcrumb', () => ({
  Breadcrumb: () => <div data-testid="breadcrumb" />,
}));

jest.mock('../OrgSwitcher', () => ({
  OrgSwitcher: () => <div data-testid="org-switcher" />,
}));

jest.mock('../NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}));

jest.mock('../ThemeToggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

jest.mock('../UserAvatarMenu', () => ({
  UserAvatarMenu: () => <div data-testid="user-avatar-menu" />,
}));

const mockToggleMobileDrawer = jest.fn();

jest.mock('@/app/hooks/useUIStore', () => ({
  useUIStore: () => ({
    toggleMobileDrawer: mockToggleMobileDrawer,
  }),
}));

beforeEach(() => {
  mockToggleMobileDrawer.mockClear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TopBar — composition', () => {
  it('renders the Breadcrumb', () => {
    render(<TopBar />);
    expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
  });

  it('renders the OrgSwitcher', () => {
    render(<TopBar />);
    expect(screen.getByTestId('org-switcher')).toBeInTheDocument();
  });

  it('renders the NotificationBell', () => {
    render(<TopBar />);
    expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
  });

  it('renders the ThemeToggle', () => {
    render(<TopBar />);
    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
  });

  it('renders the UserAvatarMenu', () => {
    render(<TopBar />);
    expect(screen.getByTestId('user-avatar-menu')).toBeInTheDocument();
  });
});

describe('TopBar — hamburger', () => {
  it('renders the hamburger button', () => {
    render(<TopBar />);
    expect(
      screen.getByRole('button', { name: 'Open navigation menu' }),
    ).toBeInTheDocument();
  });

  it('calls toggleMobileDrawer when hamburger is clicked', () => {
    render(<TopBar />);
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    expect(mockToggleMobileDrawer).toHaveBeenCalledTimes(1);
  });
});

describe('TopBar — landmark', () => {
  it('renders as a <header> with accessible label', () => {
    render(<TopBar />);
    expect(
      screen.getByRole('banner', { name: 'Application top bar' }),
    ).toBeInTheDocument();
  });
});
