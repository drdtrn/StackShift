import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAlertRules } from '@/app/hooks/queries/use-alert-rules';
import type { AlertRule } from '@/app/types';

const mockGet = jest.fn();

jest.mock('@/app/lib/api-client', () => ({
  apiClient: { get: (...args: Parameters<typeof mockGet>) => mockGet(...args) },
}));

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'TestWrapper';
  return Wrapper;
}

const RULE: AlertRule = {
  id: '11111111-1111-1111-1111-111111111111',
  projectId: '22222222-2222-2222-2222-222222222222',
  organizationId: '33333333-3333-3333-3333-333333333333',
  name: 'High Error Rate',
  condition: 'threshold',
  threshold: 5,
  windowMinutes: 15,
  logLevel: null,
  pattern: null,
  isActive: true,
  severity: 'medium',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

beforeEach(() => {
  mockGet.mockReset();
});

describe('useAlertRules', () => {
  it('calls the real alert-rules API with projectId', async () => {
    mockGet.mockResolvedValue({ data: [RULE] });

    const { result } = renderHook(() => useAlertRules(RULE.projectId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toEqual([RULE]));

    expect(mockGet).toHaveBeenCalledWith(
      '/api/v1/alert-rules',
      expect.objectContaining({
        params: { projectId: RULE.projectId },
        schema: expect.any(Object),
      }),
    );
  });

  it('does not fetch without a projectId', () => {
    renderHook(() => useAlertRules(null), { wrapper: createWrapper() });

    expect(mockGet).not.toHaveBeenCalled();
  });
});
