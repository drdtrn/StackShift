/**
 * Tests for LiveLogStream component (US-09)
 *
 * Mocks useLiveLogStream entirely so tests are pure UI unit tests.
 *
 * Verifies:
 *   - Pause button renders (AC4)
 *   - "X new" badge hidden when bufferedCount = 0
 *   - "X new" badge visible when isPaused + bufferedCount > 0 (AC4)
 *   - Clicking pause calls pause() (AC4)
 *   - Clicking resume calls resume() (AC4)
 *   - Log entries render in the list (AC3)
 *   - Empty state renders when entries = []
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { HubConnectionState } from '@microsoft/signalr';
import { LiveLogStream } from '../LiveLogStream';
import type { LogEntry } from '@/app/types';

// jsdom does not implement scrollIntoView — mock it globally for this file
window.HTMLElement.prototype.scrollIntoView = jest.fn();

// ---------------------------------------------------------------------------
// Mock useLiveLogStream
// ---------------------------------------------------------------------------

const mockPause = jest.fn();
const mockResume = jest.fn();

const defaultStreamState = {
  entries: [] as LogEntry[],
  isPaused: false,
  bufferedCount: 0,
  pause: mockPause,
  resume: mockResume,
  connectionState: HubConnectionState.Connected,
};

let streamState = { ...defaultStreamState };

jest.mock('@/app/hooks/useLiveLogStream', () => ({
  useLiveLogStream: () => streamState,
}));

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  streamState = { ...defaultStreamState, entries: [], pause: mockPause, resume: mockResume };
  mockPause.mockClear();
  mockResume.mockClear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LiveLogStream — structure', () => {
  it('renders the heading', () => {
    render(<LiveLogStream />);
    expect(screen.getByRole('heading', { name: 'Live Log Stream' })).toBeInTheDocument();
  });

  it('renders the pause button when stream is live', () => {
    render(<LiveLogStream />);
    expect(
      screen.getByRole('button', { name: 'Pause live stream' }),
    ).toBeInTheDocument();
  });
});

describe('LiveLogStream — empty state', () => {
  it('shows waiting message when entries is empty', () => {
    render(<LiveLogStream />);
    expect(screen.getByText(/waiting for log entries/i)).toBeInTheDocument();
  });
});

describe('LiveLogStream — log entry rendering (AC3)', () => {
  it('renders log entries in the list', () => {
    streamState = {
      ...defaultStreamState,
      entries: [
        {
          id: 'e1',
          projectId: 'p1',
          logSourceId: 'src-1',
          level: 'info',
          message: 'Test message one',
          timestamp: new Date().toISOString(),
          traceId: null,
          spanId: null,
          serviceName: 'svc',
          hostName: 'host',
          metadata: {},
        },
        {
          id: 'e2',
          projectId: 'p1',
          logSourceId: 'src-1',
          level: 'error',
          message: 'Test message two',
          timestamp: new Date().toISOString(),
          traceId: null,
          spanId: null,
          serviceName: 'svc',
          hostName: 'host',
          metadata: {},
        },
      ],
    };
    render(<LiveLogStream />);
    expect(screen.getByText('Test message one')).toBeInTheDocument();
    expect(screen.getByText('Test message two')).toBeInTheDocument();
  });

  it('does not show waiting message when entries exist', () => {
    streamState = {
      ...defaultStreamState,
      entries: [
        {
          id: 'e1', projectId: 'p1', logSourceId: 's', level: 'info',
          message: 'Hello', timestamp: new Date().toISOString(),
          traceId: null, spanId: null, serviceName: null, hostName: null, metadata: {},
        },
      ],
    };
    render(<LiveLogStream />);
    expect(screen.queryByText(/waiting for log entries/i)).not.toBeInTheDocument();
  });
});

describe('LiveLogStream — pause/resume (AC4)', () => {
  it('clicking pause button calls pause()', () => {
    render(<LiveLogStream />);
    fireEvent.click(screen.getByRole('button', { name: 'Pause live stream' }));
    expect(mockPause).toHaveBeenCalledTimes(1);
  });

  it('clicking resume button calls resume()', () => {
    streamState = { ...defaultStreamState, isPaused: true, bufferedCount: 0 };
    render(<LiveLogStream />);
    fireEvent.click(screen.getByRole('button', { name: 'Resume live stream' }));
    expect(mockResume).toHaveBeenCalledTimes(1);
  });

  it('does not show "new" badge when bufferedCount = 0', () => {
    streamState = { ...defaultStreamState, isPaused: true, bufferedCount: 0 };
    render(<LiveLogStream />);
    expect(screen.queryByText(/new/)).not.toBeInTheDocument();
  });

  it('shows "X new" badge when isPaused and bufferedCount > 0 (AC4)', () => {
    streamState = { ...defaultStreamState, isPaused: true, bufferedCount: 7 };
    render(<LiveLogStream />);
    expect(screen.getByText('7 new')).toBeInTheDocument();
  });
});

describe('LiveLogStream — connection state display', () => {
  it('shows "Live" when Connected', () => {
    streamState = {
      ...defaultStreamState,
      connectionState: HubConnectionState.Connected,
    };
    render(<LiveLogStream />);
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('shows "Disconnected" when Disconnected', () => {
    streamState = {
      ...defaultStreamState,
      connectionState: HubConnectionState.Disconnected,
    };
    render(<LiveLogStream />);
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });
});
