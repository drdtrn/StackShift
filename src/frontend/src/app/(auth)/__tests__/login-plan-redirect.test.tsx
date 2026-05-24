import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockReplace = jest.fn();
const mockSearchParams = new URLSearchParams();
const mockAddToast = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  useSearchParams: () => mockSearchParams,
}));

jest.mock('@/app/hooks/useSession', () => ({
  useSession: () => ({ isAuthenticated: false, isLoading: false }),
}));

jest.mock('@/app/hooks/useToastStore', () => ({
  useToastStore: () => ({ addToast: mockAddToast }),
}));

import LoginPage from '../login/page';

function renderWithQuery(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <LoginPage />
    </QueryClientProvider>,
  );
}

describe('LoginPage — plan + from query params', () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    for (const key of Array.from(mockSearchParams.keys())) mockSearchParams.delete(key);
    mockReplace.mockReset();
    mockAddToast.mockReset();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true }),
    }) as unknown as typeof global.fetch;
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  it('embeds /billing/checkout into the Google SSO href when plan=indie&from=marketing-hero', () => {
    mockSearchParams.set('plan', 'indie');
    mockSearchParams.set('from', 'marketing-hero');

    renderWithQuery();

    const sso = screen.getByRole('link', { name: /continue with google/i });
    const href = sso.getAttribute('href') ?? '';
    expect(href).toContain('/api/auth/login?next=');
    const decoded = decodeURIComponent(href.split('next=')[1].split('&')[0]);
    expect(decoded).toBe('/billing/checkout?plan=indie&from=marketing-hero');
  });

  it('embeds /billing/checkout for team plan', () => {
    mockSearchParams.set('plan', 'team');
    renderWithQuery();
    const sso = screen.getByRole('link', { name: /continue with google/i });
    const decoded = decodeURIComponent(
      (sso.getAttribute('href') ?? '').split('next=')[1].split('&')[0],
    );
    expect(decoded).toBe('/billing/checkout?plan=team');
  });

  it('ignores unknown plan values and falls back to root next', () => {
    mockSearchParams.set('plan', 'enterprise');
    renderWithQuery();
    const sso = screen.getByRole('link', { name: /continue with google/i });
    // No ?next= when next resolves to '/'
    expect(sso.getAttribute('href')).toBe('/api/auth/login?provider=google');
  });

  it('honours raw ?next= when no plan is provided', () => {
    mockSearchParams.set('next', '/projects');
    renderWithQuery();
    const sso = screen.getByRole('link', { name: /continue with google/i });
    expect(sso.getAttribute('href')).toBe('/api/auth/login?next=%2Fprojects&provider=google');
  });

  it('rejects protocol-relative open-redirect attempts', () => {
    mockSearchParams.set('next', '//evil.com/path');
    renderWithQuery();
    const sso = screen.getByRole('link', { name: /continue with google/i });
    expect(sso.getAttribute('href')).toBe('/api/auth/login?provider=google');
  });

  it('on successful POST submit, router.replace navigates to the resolved next URL', async () => {
    mockSearchParams.set('plan', 'indie');
    renderWithQuery();

    await act(async () => {
      await userEvent.type(screen.getByLabelText(/email/i), 'alice@example.com');
      await userEvent.type(screen.getByLabelText(/password/i), 'whatever');
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    });

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('/billing/checkout?plan=indie'),
    );
  });
});
