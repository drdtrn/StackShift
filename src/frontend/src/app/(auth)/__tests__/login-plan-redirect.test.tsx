import React from 'react';
import { render, screen } from '@testing-library/react';

const mockReplace = jest.fn();
const mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  useSearchParams: () => mockSearchParams,
}));

jest.mock('@/app/hooks/useSession', () => ({
  useSession: () => ({ isAuthenticated: false, isLoading: false }),
}));

jest.mock('@/app/hooks/useToastStore', () => ({
  useToastStore: () => ({ addToast: jest.fn() }),
}));

import LoginPage from '../login/page';

describe('LoginPage — plan + from query params', () => {
  beforeEach(() => {
    for (const key of Array.from(mockSearchParams.keys())) mockSearchParams.delete(key);
    mockReplace.mockReset();
  });

  it('builds /billing/checkout next URL when plan=indie&from=marketing-hero', () => {
    mockSearchParams.set('plan', 'indie');
    mockSearchParams.set('from', 'marketing-hero');

    render(<LoginPage />);

    const link = screen.getByRole('link', { name: /sign in/i });
    const href = link.getAttribute('href') ?? '';
    expect(href).toContain('/api/auth/login?next=');
    const decoded = decodeURIComponent(href.replace('/api/auth/login?next=', ''));
    expect(decoded).toBe('/billing/checkout?plan=indie&from=marketing-hero');
  });

  it('builds /billing/checkout for team plan', () => {
    mockSearchParams.set('plan', 'team');

    render(<LoginPage />);

    const link = screen.getByRole('link', { name: /sign in/i });
    const href = link.getAttribute('href') ?? '';
    const decoded = decodeURIComponent(href.replace('/api/auth/login?next=', ''));
    expect(decoded).toBe('/billing/checkout?plan=team');
  });

  it('ignores unknown plan values and falls back to standard next', () => {
    mockSearchParams.set('plan', 'enterprise');

    render(<LoginPage />);

    const link = screen.getByRole('link', { name: /sign in/i });
    expect(link.getAttribute('href')).toBe('/api/auth/login');
  });

  it('honours raw ?next= when no plan is provided', () => {
    mockSearchParams.set('next', '/projects');

    render(<LoginPage />);

    const link = screen.getByRole('link', { name: /sign in/i });
    expect(link.getAttribute('href')).toBe('/api/auth/login?next=%2Fprojects');
  });

  it('rejects protocol-relative open-redirect attempts', () => {
    mockSearchParams.set('next', '//evil.com/path');

    render(<LoginPage />);

    const link = screen.getByRole('link', { name: /sign in/i });
    expect(link.getAttribute('href')).toBe('/api/auth/login');
  });
});
