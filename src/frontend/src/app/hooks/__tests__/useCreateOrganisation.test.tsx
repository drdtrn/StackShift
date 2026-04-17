import React from 'react';
import { act, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreateOrganisation } from '../useCreateOrganisation';
import type { Organization } from '@/app/types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockAddToast = jest.fn();

jest.mock('@/app/hooks/useToastStore', () => ({
  useToastStore: jest.fn((selector: (s: { addToast: typeof mockAddToast }) => unknown) =>
    selector({ addToast: mockAddToast }),
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    qc,
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    ),
  };
}

const MOCK_ORG: Organization = {
  id: 'org-001',
  name: 'Acme Corp',
  slug: 'acme-corp',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockFetch = jest.fn();

function mockFetchSuccess(org: Organization = MOCK_ORG) {
  mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(org) });
}

function mockFetchError(body: object) {
  mockFetch.mockResolvedValueOnce({ ok: false, json: () => Promise.resolve(body) });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockPush.mockReset();
  mockAddToast.mockReset();
  mockFetch.mockReset();
  global.fetch = mockFetch as typeof global.fetch;
});

describe('useCreateOrganisation — success', () => {
  it('calls POST /api/onboarding/create-org', async () => {
    mockFetchSuccess();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateOrganisation(), { wrapper });

    await act(async () => { result.current.createOrganisation({ name: 'Acme Corp' }); });
    await waitFor(() => expect(mockPush).toHaveBeenCalled());

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/onboarding/create-org',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('shows a welcome success toast', async () => {
    mockFetchSuccess();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateOrganisation(), { wrapper });

    await act(async () => { result.current.createOrganisation({ name: 'Acme Corp' }); });
    await waitFor(() => expect(mockAddToast).toHaveBeenCalled());

    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success' }),
    );
  });

  it('redirects to "/" after org creation', async () => {
    mockFetchSuccess();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateOrganisation(), { wrapper });

    await act(async () => { result.current.createOrganisation({ name: 'Acme Corp' }); });
    await waitFor(() => expect(mockPush).toHaveBeenCalled());

    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('invalidates the auth/me query so OnboardingGuard re-evaluates', async () => {
    mockFetchSuccess();
    const { wrapper, qc } = createWrapper();
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useCreateOrganisation(), { wrapper });

    await act(async () => { result.current.createOrganisation({ name: 'Acme Corp' }); });
    await waitFor(() => expect(mockPush).toHaveBeenCalled());

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['auth', 'me'] }),
    );
  });
});

describe('useCreateOrganisation — error', () => {
  it('shows a generic error toast on failure', async () => {
    mockFetchError({ error: 'org_name_taken' });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateOrganisation(), { wrapper });

    await act(async () => { result.current.createOrganisation({ name: 'Acme Corp' }); });
    await waitFor(() => expect(mockAddToast).toHaveBeenCalled());

    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'error',
        message: expect.stringMatching(/could not create organisation/i),
      }),
    );
  });

  it('does not redirect on error', async () => {
    mockFetchError({ error: 'server_error' });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateOrganisation(), { wrapper });

    await act(async () => { result.current.createOrganisation({ name: 'Acme Corp' }); });
    await waitFor(() => expect(mockAddToast).toHaveBeenCalled());

    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('useCreateOrganisation — interface', () => {
  it('exposes createOrganisation, isPending, isError, and error', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateOrganisation(), { wrapper });

    expect(typeof result.current.createOrganisation).toBe('function');
    expect(result.current.isPending).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
