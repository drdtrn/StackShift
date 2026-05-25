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

jest.mock('@/app/hooks/useToastStore', () => ({
  useToastStore: () => ({ addToast: mockAddToast }),
}));

import AcceptInvitationPage from '../accept-invitation/page';

function renderPage(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <AcceptInvitationPage />
    </QueryClientProvider>,
  );
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

describe('AcceptInvitationPage', () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    for (const key of Array.from(mockSearchParams.keys())) mockSearchParams.delete(key);
    mockReplace.mockReset();
    mockAddToast.mockReset();
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  it('shows a missing-token fallback when ?token= is absent', () => {
    renderPage();
    expect(screen.getByText(/missing invitation token/i)).toBeInTheDocument();
  });

  it('submits the form, calls login, navigates to / on success', async () => {
    mockSearchParams.set('token', 'good-token');
    global.fetch = jest.fn((url: string) => {
      if (url === '/api/auth/accept-invitation') {
        return Promise.resolve(
          jsonResponse(200, {
            userId: '11111111-1111-1111-1111-111111111111',
            email: 'invitee@example.com',
            organizationId: '22222222-2222-2222-2222-222222222222',
            role: 'admin',
          }),
        );
      }
      if (url === '/api/auth/login') {
        return Promise.resolve(jsonResponse(200, { ok: true }));
      }
      throw new Error(`unexpected ${url}`);
    }) as unknown as typeof global.fetch;

    renderPage();

    await act(async () => {
      await userEvent.type(screen.getByLabelText(/display name/i), 'Invitee');
      await userEvent.type(screen.getByLabelText(/password/i), 'Passw0rd!234');
      await userEvent.click(screen.getByRole('button', { name: /accept and sign in/i }));
    });

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success' }),
    );
  });

  it('shows the expired/used banner on 409', async () => {
    mockSearchParams.set('token', 'expired-token');
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse(409, { error: 'expired' }),
    ) as unknown as typeof global.fetch;

    renderPage();

    await act(async () => {
      await userEvent.type(screen.getByLabelText(/display name/i), 'XY');
      await userEvent.type(screen.getByLabelText(/password/i), 'Passw0rd!234');
      await userEvent.click(screen.getByRole('button', { name: /accept and sign in/i }));
    });

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/expired or already been used/i),
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
