/**
 * Tests for the useAlertNotifications hook (US-09)
 *
 * Verifies:
 *   - Critical alert triggers error toast with pulse:true, duration:null (AC5)
 *   - High alert triggers error toast with no pulse
 *   - Medium alert triggers warning toast
 *   - Low alert triggers info toast
 *   - Handler is cleaned up on unmount (AC9)
 */

import { renderHook, act } from '@testing-library/react';
import { HubConnectionState } from '@microsoft/signalr';
import { useAlertNotifications } from '../useAlertNotifications';
import { useToastStore } from '../useToastStore';
import { useSignalRStore } from '../useSignalRStore';
import type { Alert, AlertSeverity } from '@/app/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockConnection() {
  return {
    state: HubConnectionState.Disconnected,
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    off: jest.fn(),
    onclose: jest.fn(),
    onreconnecting: jest.fn(),
    onreconnected: jest.fn(),
  };
}

function makeAlert(severity: AlertSeverity): Alert {
  return {
    id: `alert-${severity}`,
    projectId: 'proj-1',
    alertRuleId: 'rule-1',
    severity,
    title: `${severity} Alert`,
    description: `${severity} alert description`,
    firedAt: new Date().toISOString(),
    acknowledgedAt: null,
    resolvedAt: null,
    incidentId: null,
  };
}

function getAlertHandler(
  conn: ReturnType<typeof makeMockConnection>,
): (alert: Alert) => void {
  const call = conn.on.mock.calls.find(
    ([method]: [string]) => method === 'ReceiveAlert',
  );
  if (!call) throw new Error('ReceiveAlert handler not registered');
  return call[1] as (alert: Alert) => void;
}

// Reset stores between tests
beforeEach(() => {
  useToastStore.getState().clearAll();
  useSignalRStore.setState({ connectionState: HubConnectionState.Disconnected });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAlertNotifications — toast mapping (AC5)', () => {
  it('critical alert: fires error toast with pulse=true and duration=null', async () => {
    const conn = makeMockConnection();
    const addToast = jest.spyOn(useToastStore.getState(), 'addToast');

    renderHook(() =>
      useAlertNotifications({ connectionFactory: () => conn }),
    );
    await act(async () => { await conn.start.mock.results[0]?.value; });

    const handler = getAlertHandler(conn);
    act(() => { handler(makeAlert('critical')); });

    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'error',
        pulse: true,
        duration: null,
      }),
    );
    addToast.mockRestore();
  });

  it('high alert: fires error toast without pulse', async () => {
    const conn = makeMockConnection();
    const addToast = jest.spyOn(useToastStore.getState(), 'addToast');

    renderHook(() =>
      useAlertNotifications({ connectionFactory: () => conn }),
    );
    await act(async () => { await conn.start.mock.results[0]?.value; });

    const handler = getAlertHandler(conn);
    act(() => { handler(makeAlert('high')); });

    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'error',
        duration: 8000,
      }),
    );
    // pulse should not be true for high
    const callArg = addToast.mock.calls[0][0];
    expect(callArg.pulse).not.toBe(true);
    addToast.mockRestore();
  });

  it('medium alert: fires warning toast', async () => {
    const conn = makeMockConnection();
    const addToast = jest.spyOn(useToastStore.getState(), 'addToast');

    renderHook(() =>
      useAlertNotifications({ connectionFactory: () => conn }),
    );
    await act(async () => { await conn.start.mock.results[0]?.value; });

    const handler = getAlertHandler(conn);
    act(() => { handler(makeAlert('medium')); });

    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'warning',
        duration: 6000,
      }),
    );
    addToast.mockRestore();
  });

  it('low alert: fires info toast', async () => {
    const conn = makeMockConnection();
    const addToast = jest.spyOn(useToastStore.getState(), 'addToast');

    renderHook(() =>
      useAlertNotifications({ connectionFactory: () => conn }),
    );
    await act(async () => { await conn.start.mock.results[0]?.value; });

    const handler = getAlertHandler(conn);
    act(() => { handler(makeAlert('low')); });

    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'info',
        duration: 5000,
      }),
    );
    addToast.mockRestore();
  });

  it('toast message contains the alert title and description', async () => {
    const conn = makeMockConnection();
    const addToast = jest.spyOn(useToastStore.getState(), 'addToast');

    renderHook(() =>
      useAlertNotifications({ connectionFactory: () => conn }),
    );
    await act(async () => { await conn.start.mock.results[0]?.value; });

    const handler = getAlertHandler(conn);
    act(() => { handler(makeAlert('medium')); });

    const message: string = addToast.mock.calls[0][0].message;
    expect(message).toContain('medium Alert');
    expect(message).toContain('medium alert description');
    addToast.mockRestore();
  });
});

describe('useAlertNotifications — cleanup (AC9)', () => {
  it('calls off() for ReceiveAlert on unmount', async () => {
    const conn = makeMockConnection();
    const { unmount } = renderHook(() =>
      useAlertNotifications({ connectionFactory: () => conn }),
    );
    await act(async () => { await conn.start.mock.results[0]?.value; });
    act(() => { unmount(); });

    const offCalls = conn.off.mock.calls.filter(
      ([method]: [string]) => method === 'ReceiveAlert',
    );
    expect(offCalls).toHaveLength(1);
  });
});
