import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockReplace = jest.fn();
const mockAddToast = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));

jest.mock('@/app/hooks/useToastStore', () => ({
  useToastStore: () => ({ addToast: mockAddToast }),
}));

import RegisterPage from '../register/page';

function renderPage(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <RegisterPage />
    </QueryClientProvider>,
  );
}

interface FetchCall {
  url: string;
  options?: { method?: string; body?: string };
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

function captureFetch(handler: (call: FetchCall) => Response): jest.Mock {
  const fn = jest.fn((url: string, options?: RequestInit) =>
    Promise.resolve(handler({ url, options: options as FetchCall['options'] })),
  );
  global.fetch = fn as unknown as typeof global.fetch;
  return fn;
}

async function fillAndSubmit(role: 'owner' | 'viewer'): Promise<void> {
  await act(async () => {
    await userEvent.type(screen.getByLabelText(/display name/i), 'New User');
    await userEvent.type(screen.getByLabelText(/email/i), 'new@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'Passw0rd!234');
    if (role === 'owner') {
      // The "owner" radio is the first option; select it explicitly because
      // the default is 'viewer'.
      await userEvent.click(
        screen.getByLabelText(/registering my team or company/i),
      );
    }
    await userEvent.click(screen.getByRole('button', { name: /create my organisation|join an organisation/i }));
  });
}

describe('RegisterPage', () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    mockReplace.mockReset();
    mockAddToast.mockReset();
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  it('owner happy-path → /onboarding', async () => {
    captureFetch(({ url }) => {
      if (url === '/api/auth/register') {
        return jsonResponse(201, {
          userId: '11111111-1111-1111-1111-111111111111',
          email: 'new@example.com',
          role: 'owner',
          organizationId: null,
          attachedViaInvitation: false,
        });
      }
      if (url === '/api/auth/login') {
        return jsonResponse(200, { ok: true });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    renderPage();
    await fillAndSubmit('owner');

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/onboarding'));
  });

  it('viewer happy-path → /waiting', async () => {
    captureFetch(({ url }) => {
      if (url === '/api/auth/register') {
        return jsonResponse(201, {
          userId: '22222222-2222-2222-2222-222222222222',
          email: 'new@example.com',
          role: 'viewer',
          organizationId: null,
          attachedViaInvitation: false,
        });
      }
      return jsonResponse(200, { ok: true });
    });

    renderPage();
    await fillAndSubmit('viewer');

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/waiting'));
  });

  it('invitation match → / + success toast', async () => {
    captureFetch(({ url }) => {
      if (url === '/api/auth/register') {
        return jsonResponse(201, {
          userId: '33333333-3333-3333-3333-333333333333',
          email: 'new@example.com',
          role: 'admin',
          organizationId: '00000000-0000-0000-0000-000000000001',
          attachedViaInvitation: true,
        });
      }
      return jsonResponse(200, { ok: true });
    });

    renderPage();
    await fillAndSubmit('owner');

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success' }),
    );
  });

  it('409 from register → duplicate-email toast, no navigation', async () => {
    captureFetch(() => jsonResponse(409, { error: 'duplicate' }));

    renderPage();
    await fillAndSubmit('viewer');

    await waitFor(() =>
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'error',
          message: expect.stringMatching(/already registered/i),
        }),
      ),
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
