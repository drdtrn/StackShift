import { renderHook } from '@testing-library/react';
import { HubConnectionState } from '@microsoft/signalr';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { Alert, AlertSeverity, AiAnalysis, LogEntry } from '@/app/types';
import type { IHubConnection } from '@/app/lib/signalr-mock';
import { SignalRConnectionContext } from '../useSignalRConnectionContext';
import { useSignalREvents } from '../useSignalREvents';
import { useNotificationStore } from '../useNotificationStore';
import { queryKeys } from '@/app/lib/query-keys';
import {
  HUB_METHOD_LOG_ENTRY,
  HUB_METHOD_ALERT,
  HUB_METHOD_AI_ANALYSIS_COMPLETED,
} from '@/app/lib/signalr-config';

type HubHandler = Parameters<IHubConnection['on']>[1];

interface MockConnection {
  connection: IHubConnection;
  handlers: Map<string, HubHandler>;
  onSpy: jest.Mock;
  offSpy: jest.Mock;
}

function makeMockConnection(): MockConnection {
  const handlers = new Map<string, HubHandler>();
  const onSpy = jest.fn((method: string, handler: HubHandler) => {
    handlers.set(method, handler);
  });
  const offSpy = jest.fn((method: string) => {
    handlers.delete(method);
  });
  const connection: IHubConnection = {
    state: HubConnectionState.Connected,
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    invoke: jest.fn().mockResolvedValue(undefined),
    on: onSpy,
    off: offSpy,
    onclose: jest.fn(),
    onreconnecting: jest.fn(),
    onreconnected: jest.fn(),
  };
  return { connection, handlers, onSpy, offSpy };
}

function makeAlert(severity: AlertSeverity = 'high'): Alert {
  return {
    id: 'alert-1',
    projectId: 'proj-1',
    alertRuleId: 'rule-1',
    severity,
    title: 'High Alert',
    description: 'something fired',
    firedAt: new Date().toISOString(),
    acknowledgedAt: null,
    resolvedAt: null,
    incidentId: 'inc-1',
  };
}

function makeAnalysis(): AiAnalysis {
  return {
    id: 'ai-1',
    incidentId: 'inc-99',
    projectId: 'proj-1',
    status: 'completed',
    summary: 'redis cascade',
    rootCause: 'Redis OOM',
    suggestedFixes: ['set allkeys-lru'],
    relevantLogIds: ['log-1'],
    confidenceScore: 0.9,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };
}

function makeLogEntry(): LogEntry {
  return {
    id: 'log-1',
    projectId: 'proj-1',
    logSourceId: 'src-1',
    level: 'error',
    message: 'NullReferenceException',
    timestamp: new Date().toISOString(),
    traceId: null,
    spanId: null,
    serviceName: 'api',
    hostName: 'host-1',
    metadata: {},
  };
}

function setup(connection: IHubConnection | null) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
  const setDataSpy = jest.spyOn(queryClient, 'setQueryData');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <SignalRConnectionContext.Provider value={connection}>
        {children}
      </SignalRConnectionContext.Provider>
    </QueryClientProvider>
  );
  return { queryClient, invalidateSpy, setDataSpy, wrapper };
}

beforeEach(() => {
  useNotificationStore.getState().reset();
});

describe('useSignalREvents — subscription lifecycle', () => {
  it('subscribes to all three hub methods on mount', () => {
    const mock = makeMockConnection();
    const { wrapper } = setup(mock.connection);

    renderHook(() => useSignalREvents(), { wrapper });

    const methods = mock.onSpy.mock.calls.map(([m]: [string]) => m);
    expect(methods).toContain(HUB_METHOD_LOG_ENTRY);
    expect(methods).toContain(HUB_METHOD_ALERT);
    expect(methods).toContain(HUB_METHOD_AI_ANALYSIS_COMPLETED);
  });

  it('is a no-op when no connection is provided via context', () => {
    const { wrapper } = setup(null);
    expect(() => renderHook(() => useSignalREvents(), { wrapper })).not.toThrow();
  });

  it('unsubscribes from all three hub methods on unmount', () => {
    const mock = makeMockConnection();
    const { wrapper } = setup(mock.connection);

    const { unmount } = renderHook(() => useSignalREvents(), { wrapper });
    unmount();

    const methods = mock.offSpy.mock.calls.map(([m]: [string]) => m);
    expect(methods).toContain(HUB_METHOD_LOG_ENTRY);
    expect(methods).toContain(HUB_METHOD_ALERT);
    expect(methods).toContain(HUB_METHOD_AI_ANALYSIS_COMPLETED);
  });
});

describe('useSignalREvents — ReceiveAlert', () => {
  it('increments the unread notification count', () => {
    const mock = makeMockConnection();
    const { wrapper } = setup(mock.connection);
    renderHook(() => useSignalREvents(), { wrapper });

    const handler = mock.handlers.get(HUB_METHOD_ALERT);
    if (!handler) throw new Error('ReceiveAlert handler missing');
    handler(makeAlert());

    expect(useNotificationStore.getState().unread).toBe(1);
  });

  it('invalidates dashboard stats + alerts list caches', () => {
    const mock = makeMockConnection();
    const { invalidateSpy, wrapper } = setup(mock.connection);
    renderHook(() => useSignalREvents(), { wrapper });

    const handler = mock.handlers.get(HUB_METHOD_ALERT);
    if (!handler) throw new Error('ReceiveAlert handler missing');
    handler(makeAlert());

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.dashboard.stats(),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.alerts.all,
    });
  });
});

describe('useSignalREvents — ReceiveAiAnalysisCompleted', () => {
  it('writes the analysis directly to its detail cache', () => {
    const mock = makeMockConnection();
    const { setDataSpy, wrapper } = setup(mock.connection);
    renderHook(() => useSignalREvents(), { wrapper });

    const analysis = makeAnalysis();
    const handler = mock.handlers.get(HUB_METHOD_AI_ANALYSIS_COMPLETED);
    if (!handler) throw new Error('ReceiveAiAnalysisCompleted handler missing');
    handler(analysis);

    expect(setDataSpy).toHaveBeenCalledWith(
      queryKeys.aiAnalyses.detail(analysis.id),
      analysis,
    );
  });

  it('invalidates the parent incident detail cache', () => {
    const mock = makeMockConnection();
    const { invalidateSpy, wrapper } = setup(mock.connection);
    renderHook(() => useSignalREvents(), { wrapper });

    const analysis = makeAnalysis();
    const handler = mock.handlers.get(HUB_METHOD_AI_ANALYSIS_COMPLETED);
    if (!handler) throw new Error('ReceiveAiAnalysisCompleted handler missing');
    handler(analysis);

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.incidents.detail(analysis.incidentId),
    });
  });
});

describe('useSignalREvents — ReceiveLogEntry', () => {
  it('marks the logs cache stale without forcing a refetch', () => {
    const mock = makeMockConnection();
    const { invalidateSpy, wrapper } = setup(mock.connection);
    renderHook(() => useSignalREvents(), { wrapper });

    const handler = mock.handlers.get(HUB_METHOD_LOG_ENTRY);
    if (!handler) throw new Error('ReceiveLogEntry handler missing');
    handler(makeLogEntry());

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.logs.all,
      refetchType: 'none',
    });
  });
});
