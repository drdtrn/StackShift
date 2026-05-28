import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StackSiftTransport } from '../src/transport.js';

interface RecordedRequest {
  url: string;
  body: unknown;
  apiKey: string | null;
  at: number;
}

interface ResponderState {
  responder: (attempt: number) => Response | Promise<Response>;
  attempts: number;
  requests: RecordedRequest[];
}

const state: ResponderState = {
  responder: () => new Response(null, { status: 202 }),
  attempts: 0,
  requests: [],
};

const realFetch = globalThis.fetch;

beforeEach(() => {
  state.responder = () => new Response(null, { status: 202 });
  state.attempts = 0;
  state.requests = [];
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : (input as { url: string }).url;
    const apiKey = (init?.headers as Record<string, string> | undefined)?.['X-Api-Key'] ?? null;
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    state.requests.push({ url, body, apiKey, at: Date.now() });
    state.attempts++;
    return state.responder(state.attempts);
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

const BASE_OPTIONS = {
  ingestUrl: 'https://example.test/api/v1/logs/ingest',
  apiKey: 'ss_test-key-value-that-is-long-enough',
  projectId: '11111111-1111-1111-1111-111111111111',
  logSourceId: '22222222-2222-2222-2222-222222222222',
  serviceName: 'test-svc',
  bufferSize: 1,
  flushInterval: 60_000,
  initialRetryDelay: 20,
  maxRetryDelay: 80,
  maxRetries: 5,
  requestTimeout: 2000,
} as const;

function makeTransport(overrides: Partial<typeof BASE_OPTIONS> = {}) {
  return new StackSiftTransport({ ...BASE_OPTIONS, ...overrides });
}

function logOne(transport: StackSiftTransport, info: Record<string, unknown>) {
  return new Promise<void>((resolve) => {
    transport.log(
      {
        level: 'info',
        message: 'msg',
        timestamp: new Date().toISOString(),
        ...info,
      },
      () => resolve(),
    );
  });
}

async function waitForRequests(min: number, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (state.requests.length >= min) return;
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe('StackSiftTransport', () => {
  it('posts a batch with the correct shape on happy path', async () => {
    const t = makeTransport();
    await logOne(t, { level: 'error', message: 'checkout failed' });
    await waitForRequests(1);
    await t.close();

    expect(state.requests.length).toBe(1);
    const req = state.requests[0]!;
    expect(req.url).toBe(BASE_OPTIONS.ingestUrl);
    expect(req.apiKey).toBe(BASE_OPTIONS.apiKey);

    const body = req.body as { projectId: string; logSourceId: string; entries: Array<{ level: string; message: string; serviceName: string }> };
    expect(body.projectId).toBe(BASE_OPTIONS.projectId);
    expect(body.logSourceId).toBe(BASE_OPTIONS.logSourceId);
    expect(body.entries.length).toBe(1);
    expect(body.entries[0]!.level).toBe('Error');
    expect(body.entries[0]!.message).toBe('checkout failed');
    expect(body.entries[0]!.serviceName).toBe('test-svc');
  });

  it('drops the batch on 401 without retrying', async () => {
    state.responder = () => new Response(null, { status: 401 });
    const warn = vi.fn();
    const t = makeTransport();
    t.on('warn', warn);

    await logOne(t, {});
    await waitForRequests(1);
    await new Promise((r) => setTimeout(r, 100));
    await t.close();

    expect(state.requests.length).toBe(1);
    expect(warn).toHaveBeenCalled();
    expect(t.getDroppedCount()).toBeGreaterThanOrEqual(1);
  });

  it('honours Retry-After on 429', async () => {
    state.responder = (attempt) => {
      if (attempt === 1) {
        return new Response(null, { status: 429, headers: { 'Retry-After': '0.2' } });
      }
      return new Response(null, { status: 202 });
    };
    const t = makeTransport();

    await logOne(t, {});
    await waitForRequests(2, 3000);
    await t.close();

    expect(state.requests.length).toBeGreaterThanOrEqual(2);
    const gap = state.requests[1]!.at - state.requests[0]!.at;
    expect(gap).toBeGreaterThanOrEqual(150);
  });

  it('retries on 5xx with exponential backoff and eventually succeeds', async () => {
    state.responder = (attempt) =>
      attempt < 3 ? new Response(null, { status: 500 }) : new Response(null, { status: 202 });

    const t = makeTransport();
    await logOne(t, {});
    await waitForRequests(3, 3000);
    await t.close();

    expect(state.requests.length).toBeGreaterThanOrEqual(3);
  });

  it('gives up after maxRetries 500s and increments drop counter', async () => {
    state.responder = () => new Response(null, { status: 500 });
    const warn = vi.fn();
    const t = makeTransport({ maxRetries: 2 });
    t.on('warn', warn);

    await logOne(t, {});
    await waitForRequests(3, 3000);
    await new Promise((r) => setTimeout(r, 100));
    await t.close();

    expect(state.requests.length).toBeGreaterThanOrEqual(3);
    expect(warn).toHaveBeenCalled();
    expect(t.getDroppedCount()).toBeGreaterThanOrEqual(1);
  });

  it('drops new events when the queue is full', async () => {
    let release: (() => void) | null = null;
    const gate = new Promise<void>((r) => (release = r));
    state.responder = async () => {
      await gate;
      return new Response(null, { status: 202 });
    };

    const t = makeTransport({ bufferSize: 5, queueCapacityMultiplier: 2 });
    await logOne(t, { message: 'primer' });
    await waitForRequests(1);

    for (let i = 0; i < 200; i++) {
      await logOne(t, { message: `e-${i}` });
    }

    expect(t.getDroppedCount()).toBeGreaterThan(0);
    release!();
    await t.close();
  });

  it('flush drains the in-memory queue', async () => {
    const t = makeTransport({ bufferSize: 100, flushInterval: 60_000 });
    for (let i = 0; i < 5; i++) await logOne(t, { message: `q-${i}` });

    expect(state.requests.length).toBe(0);
    await t.flush();
    expect(state.requests.length).toBeGreaterThanOrEqual(1);
    await t.close();
  });

  it.each([
    ['silly', 'Trace'],
    ['verbose', 'Debug'],
    ['debug', 'Debug'],
    ['info', 'Info'],
    ['http', 'Info'],
    ['warn', 'Warning'],
    ['error', 'Error'],
  ])('maps winston level %s to StackSift %s', async (winstonLevel, expected) => {
    const t = makeTransport();
    await logOne(t, { level: winstonLevel });
    await waitForRequests(1);
    await t.close();

    const body = state.requests[0]!.body as { entries: Array<{ level: string }> };
    expect(body.entries[0]!.level).toBe(expected);
  });

  it('keeps extra winston fields under metadata', async () => {
    const t = makeTransport();
    await logOne(t, { userId: 'u_42', amount: 49.99 });
    await waitForRequests(1);
    await t.close();

    const body = state.requests[0]!.body as { entries: Array<{ metadata?: Record<string, unknown> }> };
    expect(body.entries[0]!.metadata).toEqual({ userId: 'u_42', amount: 49.99 });
  });

  it('propagates serviceName option onto every entry', async () => {
    const t = makeTransport({ bufferSize: 1, serviceName: 'billing-worker' });
    await logOne(t, {});
    await logOne(t, {});
    await waitForRequests(2);
    await t.close();

    for (const req of state.requests) {
      const body = req.body as { entries: Array<{ serviceName: string }> };
      for (const entry of body.entries) {
        expect(entry.serviceName).toBe('billing-worker');
      }
    }
  });

  it('rejects missing required options', () => {
    expect(() => new StackSiftTransport({ ingestUrl: '', apiKey: 'x', projectId: 'p', logSourceId: 's' }))
      .toThrow(/ingestUrl/);
    expect(() => new StackSiftTransport({ ingestUrl: 'https://x', apiKey: '', projectId: 'p', logSourceId: 's' }))
      .toThrow(/apiKey/);
  });
});
