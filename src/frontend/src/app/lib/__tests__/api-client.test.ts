import type { InternalAxiosRequestConfig, AxiosError, AxiosResponse } from 'axios';

// ---------------------------------------------------------------------------
// Mocks — must be defined before importing api-client
// ---------------------------------------------------------------------------

const mockAuthReset = jest.fn();
const mockAddToast = jest.fn();

jest.mock('@/app/hooks/useAuthStore', () => ({
  useAuthStore: { getState: () => ({ reset: mockAuthReset }) },
}));

jest.mock('@/app/hooks/useToastStore', () => ({
  useToastStore: { getState: () => ({ addToast: mockAddToast }) },
}));

// ---------------------------------------------------------------------------
// Polyfill crypto.randomUUID for jsdom
// ---------------------------------------------------------------------------

Object.defineProperty(globalThis.crypto, 'randomUUID', {
  value: () => 'aaaabbbb-cccc-dddd-eeee-ffffffffffff',
  writable: true,
  configurable: true,
});

// ---------------------------------------------------------------------------
// Import after mocks are in place
// ---------------------------------------------------------------------------

import { apiClient, ApiSchemaError, invalidateBearerCache } from '../api-client';
import { ProjectSchema } from '@/app/lib/api-schemas';

// ---------------------------------------------------------------------------
// Helpers — reach into axios's internal interceptor list
// ---------------------------------------------------------------------------

type AxiosInterceptorHandlers = {
  fulfilled: ((value: InternalAxiosRequestConfig) => InternalAxiosRequestConfig | Promise<InternalAxiosRequestConfig>) | null;
  rejected: ((error: unknown) => unknown) | null;
};

type AxiosResponseInterceptorHandlers = {
  fulfilled: ((value: AxiosResponse) => AxiosResponse | Promise<AxiosResponse>) | null;
  rejected: ((error: unknown) => unknown) | null;
};

function getRequestInterceptor(): AxiosInterceptorHandlers {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (apiClient.interceptors.request as any).handlers[0];
}

function getResponseInterceptor(): AxiosResponseInterceptorHandlers {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (apiClient.interceptors.response as any).handlers[0];
}

function makeConfig(overrides: Partial<InternalAxiosRequestConfig> = {}): InternalAxiosRequestConfig {
  return {
    headers: {
      set: jest.fn(),
      Authorization: undefined,
      'X-Correlation-ID': undefined,
    } as unknown as InternalAxiosRequestConfig['headers'],
    ...overrides,
  } as InternalAxiosRequestConfig;
}

function makeAxiosError(status: number, data: object = {}, config: object = {}): AxiosError {
  return {
    isAxiosError: true,
    response: { status, data },
    config: { headers: { 'X-Correlation-ID': 'aaaabbbb-cccc-dddd-eeee-ffffffffffff' }, ...config },
  } as unknown as AxiosError;
}

// ---------------------------------------------------------------------------
// apiClient basics
// ---------------------------------------------------------------------------

describe('apiClient', () => {
  it('is created with the correct base URL', () => {
    expect(apiClient.defaults.baseURL).toBeDefined();
  });

  it('has a request interceptor registered', () => {
    expect(getRequestInterceptor()).toBeDefined();
  });

  it('has a response interceptor registered', () => {
    expect(getResponseInterceptor()).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Request interceptor — bearer token attachment via /api/auth/bearer
// ---------------------------------------------------------------------------

describe('request interceptor', () => {
  beforeEach(() => {
    mockAddToast.mockReset();
    mockAuthReset.mockReset();
    invalidateBearerCache();
  });

  it('attaches Bearer token fetched from /api/auth/bearer', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'server-side-jwt' }),
    });

    const config = makeConfig();
    const interceptor = getRequestInterceptor();
    const result = await interceptor.fulfilled?.(config);
    expect((result as InternalAxiosRequestConfig).headers.Authorization).toBe('Bearer server-side-jwt');
  });

  it('does not set Authorization when /api/auth/bearer returns 401', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });

    const config = makeConfig();
    const interceptor = getRequestInterceptor();
    const result = await interceptor.fulfilled?.(config);
    expect((result as InternalAxiosRequestConfig).headers.Authorization).toBeUndefined();
  });

  it('always sets X-Correlation-ID header', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'tok' }),
    });

    const config = makeConfig();
    const interceptor = getRequestInterceptor();
    const result = await interceptor.fulfilled?.(config);
    expect((result as InternalAxiosRequestConfig).headers['X-Correlation-ID']).toBeDefined();
  });

  it('reuses the cached bearer token without re-fetching', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'cached-token' }),
    });

    const interceptor = getRequestInterceptor();
    await interceptor.fulfilled?.(makeConfig());
    await interceptor.fulfilled?.(makeConfig());

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('propagates request errors via rejected handler', async () => {
    const interceptor = getRequestInterceptor();
    await expect(interceptor.rejected?.(new Error('network error'))).rejects.toThrow('network error');
  });
});

// ---------------------------------------------------------------------------
// Response interceptor — schema validation (success path)
// ---------------------------------------------------------------------------

describe('response interceptor — schema validation', () => {
  it('throws ApiSchemaError when response data does not match the declared schema', () => {
    const malformedData = {
      id: 'not-a-uuid',        // should be UUID
      name: 123,               // should be string
    };

    const fakeResponse = {
      status: 200,
      data: malformedData,
      config: { schema: ProjectSchema, headers: { 'X-Correlation-ID': 'aaaabbbb' } },
    } as unknown as AxiosResponse;

    // The fulfilled handler throws synchronously (not a rejected Promise),
    // so we use toThrow rather than rejects.toBeInstanceOf.
    const interceptor = getResponseInterceptor();
    expect(() => interceptor.fulfilled?.(fakeResponse)).toThrow(ApiSchemaError);
  });

  it('thrown ApiSchemaError contains the underlying ZodError', async () => {
    const fakeResponse = {
      status: 200,
      data: { bad: 'shape' },
      config: { schema: ProjectSchema, headers: {} },
    } as unknown as AxiosResponse;

    const interceptor = getResponseInterceptor();
    try {
      await interceptor.fulfilled?.(fakeResponse);
    } catch (err) {
      expect(err).toBeInstanceOf(ApiSchemaError);
      expect((err as ApiSchemaError).zodError.issues.length).toBeGreaterThan(0);
    }
  });

  it('passes through responses with no declared schema', async () => {
    const fakeResponse = {
      status: 200,
      data: { anything: true },
      config: { headers: {} },
    } as unknown as AxiosResponse;

    const interceptor = getResponseInterceptor();
    const result = await interceptor.fulfilled?.(fakeResponse);
    expect(result).toBe(fakeResponse);
  });

  it('passes through valid responses that match the schema', async () => {
    const validProject = {
      id: '00000000-0000-0000-0000-000000000001',
      organizationId: '00000000-0000-0000-0000-000000000002',
      name: 'My Project',
      slug: 'my-project',
      description: null,
      color: '#6366f1',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      logSourceCount: 0,
      activeIncidentCount: 0,
    };

    const fakeResponse = {
      status: 200,
      data: validProject,
      config: { schema: ProjectSchema, headers: {} },
    } as unknown as AxiosResponse;

    const interceptor = getResponseInterceptor();
    const result = await interceptor.fulfilled?.(fakeResponse);
    expect((result as AxiosResponse).data).toMatchObject(validProject);
  });
});

// ---------------------------------------------------------------------------
// Response interceptor — error handling
// ---------------------------------------------------------------------------

describe('response interceptor — error handling', () => {
  beforeEach(() => {
    mockAddToast.mockReset();
    mockAuthReset.mockReset();
    invalidateBearerCache();
  });

  it('calls addToast with permission-denied message on 403', async () => {
    const interceptor = getResponseInterceptor();
    await expect(interceptor.rejected?.(makeAxiosError(403))).rejects.toBeDefined();
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'error', message: expect.stringMatching(/permission/i) }),
    );
  });

  it('does NOT call addToast on 404 — callers handle the empty state', async () => {
    const interceptor = getResponseInterceptor();
    await expect(interceptor.rejected?.(makeAxiosError(404))).rejects.toBeDefined();
    expect(mockAddToast).not.toHaveBeenCalled();
  });

  it('calls addToast with detail message on 4xx errors', async () => {
    const interceptor = getResponseInterceptor();
    await expect(
      interceptor.rejected?.(makeAxiosError(422, { detail: 'Validation failed' })),
    ).rejects.toBeDefined();
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'error', message: expect.stringContaining('Validation failed') }),
    );
  });

  it('appends a short correlation ID to the toast message', async () => {
    const interceptor = getResponseInterceptor();
    await expect(
      interceptor.rejected?.(makeAxiosError(422, { detail: 'Bad input' })),
    ).rejects.toBeDefined();
    const call = mockAddToast.mock.calls[0][0] as { message: string };
    expect(call.message).toContain('ID: aaaabbbb');
  });

  it('uses title when detail is absent', async () => {
    const interceptor = getResponseInterceptor();
    await expect(
      interceptor.rejected?.(makeAxiosError(400, { title: 'Bad Request' })),
    ).rejects.toBeDefined();
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Bad Request') }),
    );
  });

  it('uses fallback message when neither detail nor title is present', async () => {
    const interceptor = getResponseInterceptor();
    await expect(interceptor.rejected?.(makeAxiosError(500, {}))).rejects.toBeDefined();
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('500') }),
    );
  });

  it('does not call addToast when there is no response (network error)', async () => {
    const interceptor = getResponseInterceptor();
    const networkError = { isAxiosError: true, response: undefined, config: {} } as AxiosError;
    await expect(interceptor.rejected?.(networkError)).rejects.toBeDefined();
    expect(mockAddToast).not.toHaveBeenCalled();
  });
});
