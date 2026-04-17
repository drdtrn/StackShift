/**
 * Tests for ConnectionStatusIndicator (US-09)
 *
 * Verifies:
 *   - Correct aria-label for each HubConnectionState (AC6)
 *   - Green dot for Connected
 *   - Amber dot for Reconnecting + spinner is present
 *   - Red dot for Disconnected
 *   - Connecting shows amber dot
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { HubConnectionState } from '@microsoft/signalr';
import { ConnectionStatusIndicator } from '../ConnectionStatusIndicator';
import { useSignalRStore } from '@/app/hooks/useSignalRStore';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConnectionStatusIndicator — Connected (AC6)', () => {
  beforeEach(() => {
    useSignalRStore.setState({
      connectionState: HubConnectionState.Connected,
    });
  });

  it('shows aria-label "SignalR connection: Connected"', () => {
    render(<ConnectionStatusIndicator />);
    expect(
      screen.getByLabelText('SignalR connection: Connected'),
    ).toBeInTheDocument();
  });

  it('shows a green dot', () => {
    const { container } = render(<ConnectionStatusIndicator />);
    const dot = container.querySelector('.bg-green-500');
    expect(dot).toBeInTheDocument();
  });

  it('does not show a spinner', () => {
    render(<ConnectionStatusIndicator />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('ConnectionStatusIndicator — Reconnecting (AC6)', () => {
  beforeEach(() => {
    useSignalRStore.setState({
      connectionState: HubConnectionState.Reconnecting,
    });
  });

  it('shows aria-label "SignalR connection: Reconnecting"', () => {
    render(<ConnectionStatusIndicator />);
    expect(
      screen.getByLabelText('SignalR connection: Reconnecting'),
    ).toBeInTheDocument();
  });

  it('shows an amber dot', () => {
    const { container } = render(<ConnectionStatusIndicator />);
    const dot = container.querySelector('.bg-amber-400');
    expect(dot).toBeInTheDocument();
  });

  it('shows a spinner', () => {
    render(<ConnectionStatusIndicator />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});

describe('ConnectionStatusIndicator — Disconnected (AC6)', () => {
  beforeEach(() => {
    useSignalRStore.setState({
      connectionState: HubConnectionState.Disconnected,
    });
  });

  it('shows aria-label "SignalR connection: Disconnected"', () => {
    render(<ConnectionStatusIndicator />);
    expect(
      screen.getByLabelText('SignalR connection: Disconnected'),
    ).toBeInTheDocument();
  });

  it('shows a red dot', () => {
    const { container } = render(<ConnectionStatusIndicator />);
    const dot = container.querySelector('.bg-red-500');
    expect(dot).toBeInTheDocument();
  });

  it('does not show a spinner', () => {
    render(<ConnectionStatusIndicator />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('ConnectionStatusIndicator — Connecting', () => {
  beforeEach(() => {
    useSignalRStore.setState({
      connectionState: HubConnectionState.Connecting,
    });
  });

  it('shows aria-label "SignalR connection: Connecting"', () => {
    render(<ConnectionStatusIndicator />);
    expect(
      screen.getByLabelText('SignalR connection: Connecting'),
    ).toBeInTheDocument();
  });

  it('shows an amber dot', () => {
    const { container } = render(<ConnectionStatusIndicator />);
    const dot = container.querySelector('.bg-amber-400');
    expect(dot).toBeInTheDocument();
  });
});
