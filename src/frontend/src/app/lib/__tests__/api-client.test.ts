import type { InternalAxiosRequestConfig, AxiosError, AxiosResponse } from 'axios';

// ---------------------------------------------------------------------------
// Mocks — must be defined before importing api-client
// ---------------------------------------------------------------------------

const mockGetState = jest.fn();
const mockAuthReset = jest.fn();
const mockAddToast = jest.fn();

jest.mock('@/app/hooks/useAuthStore', () => ({
  useAuthStore: { getState: () => mockGetState() },
}));

jest.mock('@/app/hooks/useToastStore', () => ({
  useToastStore: { getState: () => ({ addToast: mockAddToast }) },
}));

// ---------------------------------------------------------------------------
// Polyfill crypto.randomUUID for jsdom
// ---------------------------------------------------------------------------

Object.defineProperty(globalThis.crypto, 'randomUUID', {
  value: () => 'test-uuid-1234',
  writable: true,
  configurable: true,
});

// ---------------------------------------------------------------------------
// Import after mocks are in place
// ---------------------------------------------------------------------------

import { apiClient } from '../api-client';

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
  // axios stores interceptors in the internal `handlers` array
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (apiClient.interceptors.request as any).handlers[0];
}

function getResponseInterceptor(): AxiosResponseInterceptorHandlers {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (apiClient.interceptors.response as any).handlers[0];
}

function makeConfig(overrides: Partial<InternalAxiosRequestConfig> = {}): InternalAxiosRequestConfig {
  return {
    headers: { set: jest.fn(), Authorization: undefined, 'X-Correlation-ID': undefined } as unknown as InternalAxiosRequestConfig['headers'],
    ...overrides,
  } as InternalAxiosRequestConfig;
}

function makeAxiosError(status: number, data: object = {}): AxiosError {
  return {
    isAxiosError: true,
    response: { status, data },
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
// Request interceptor — token attachment
// ---------------------------------------------------------------------------

describe('request interceptor', () => {
  beforeEach(() => {
    mockGetState.mockReset();
    mockAddToast.mockReset();
    mockAuthReset.mockReset();
  });

  it('attaches Bearer token when token is present', async () => {
    mockGetState.mockReturnValue({ token: 'my-jwt-token', reset: mockAuthReset });
    const config = makeConfig();
    const interceptor = getRequestInterceptor();
    const result = await interceptor.fulfilled?.(config);
    expect((result as InternalAxiosRequestConfig).headers.Authorization).toBe('Bearer my-jwt-token');
  });

  it('does not set Authorization when token is absent', async () => {
    mockGetState.mockReturnValue({ token: null, reset: mockAuthReset });
    const config = makeConfig();
    const interceptor = getRequestInterceptor();
    const result = await interceptor.fulfilled?.(config);
    // Authorization header should not be set
    expect((result as InternalAxiosRequestConfig).headers.Authorization).toBeUndefined();
  });

  it('always sets X-Correlation-ID header', async () => {
    mockGetState.mockReturnValue({ token: null, reset: mockAuthReset });
    const config = makeConfig();
    const interceptor = getRequestInterceptor();
    const result = await interceptor.fulfilled?.(config);
    expect((result as InternalAxiosRequestConfig).headers['X-Correlation-ID']).toBeDefined();
  });

  it('propagates request errors via rejected handler', async () => {
    const interceptor = getRequestInterceptor();
    await expect(interceptor.rejected?.(new Error('network error'))).rejects.toThrow('network error');
  });
});

// ---------------------------------------------------------------------------
// Response interceptor — error handling
// ---------------------------------------------------------------------------

describe('response interceptor', () => {
  beforeEach(() => {
    mockGetState.mockReturnValue({ token: 'tok', reset: mockAuthReset });
    mockAddToast.mockReset();
    mockAuthReset.mockReset();
  });

  it('passes through successful responses unchanged', async () => {
    const interceptor = getResponseInterceptor();
    const fakeResponse = { status: 200, data: { ok: true } } as AxiosResponse;
    const result = await interceptor.fulfilled?.(fakeResponse);
    expect(result).toBe(fakeResponse);
  });

  it('calls addToast with session-expired message on 401', async () => {
    const interceptor = getResponseInterceptor();
    await expect(interceptor.rejected?.(makeAxiosError(401))).rejects.toBeDefined();
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'error', message: expect.stringMatching(/session has expired/i) }),
    );
  });

  it('calls addToast with permission error on 403', async () => {
    const interceptor = getResponseInterceptor();
    await expect(interceptor.rejected?.(makeAxiosError(403))).rejects.toBeDefined();
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'error', message: expect.stringMatching(/permission/i) }),
    );
  });

  it('calls addToast with generic message on other 4xx', async () => {
    const interceptor = getResponseInterceptor();
    await expect(interceptor.rejected?.(makeAxiosError(422, { detail: 'Validation failed' }))).rejects.toBeDefined();
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'error', message: 'Validation failed' }),
    );
  });

  it('uses title when detail is absent on 4xx', async () => {
    const interceptor = getResponseInterceptor();
    await expect(interceptor.rejected?.(makeAxiosError(400, { title: 'Bad Request' }))).rejects.toBeDefined();
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Bad Request' }),
    );
  });

  it('uses fallback message when neither detail nor title is present', async () => {
    const interceptor = getResponseInterceptor();
    await expect(interceptor.rejected?.(makeAxiosError(500, {}))).rejects.toBeDefined();
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/500/) }),
    );
  });

  it('does not call addToast when there is no response (network error)', async () => {
    const interceptor = getResponseInterceptor();
    const networkError = { isAxiosError: true, response: undefined } as AxiosError;
    await expect(interceptor.rejected?.(networkError)).rejects.toBeDefined();
    expect(mockAddToast).not.toHaveBeenCalled();
  });
});
