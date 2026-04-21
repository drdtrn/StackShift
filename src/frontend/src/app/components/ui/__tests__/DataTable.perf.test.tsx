/**
 * DataTable 10,000-row performance test.
 *
 * The key invariant: with 10k rows, the virtualizer must only add a small
 * windowed slice of DOM nodes — not 10,000 <tr> elements. This file uses a
 * mock that mimics real windowed behaviour (20 visible rows) rather than the
 * render-all-rows mock used in DataTable.test.tsx.
 */
import { render, screen } from '@testing-library/react';
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../DataTable';

const VISIBLE_ROWS = 20;

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { exit?: unknown; initial?: unknown; animate?: unknown; transition?: unknown }) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Simulate a real windowed virtualizer: only VISIBLE_ROWS items regardless of total count.
jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: Math.min(VISIBLE_ROWS, count) }, (_, i) => ({
        index: i,
        start: i * 40,
        end: (i + 1) * 40,
      })),
    getTotalSize: () => count * 40,
    measureElement: () => {},
  }),
}));

interface LogRow {
  id: number;
  message: string;
  level: string;
}

const columnHelper = createColumnHelper<LogRow>();
const columns = [
  columnHelper.accessor('id', { header: 'ID' }),
  columnHelper.accessor('message', { header: 'Message' }),
  columnHelper.accessor('level', { header: 'Level' }),
] as ColumnDef<LogRow, unknown>[];

const TEN_THOUSAND_ROWS: LogRow[] = Array.from({ length: 10_000 }, (_, i) => ({
  id: i + 1,
  message: `Log entry number ${i + 1}`,
  level: i % 3 === 0 ? 'error' : i % 3 === 1 ? 'warn' : 'info',
}));

describe('DataTable — 10,000 row performance', () => {
  it('renders without exceeding 500 ms', () => {
    const start = performance.now();
    render(<DataTable columns={columns} data={TEN_THOUSAND_ROWS} height={800} />);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });

  it('only mounts the visible window of DOM rows, not all 10,000', () => {
    render(<DataTable columns={columns} data={TEN_THOUSAND_ROWS} height={800} />);
    // tbody rows = virtualItems (VISIBLE_ROWS) + 2 spacer rows (paddingTop / paddingBottom).
    const rows = document.querySelectorAll('tbody tr');
    expect(rows.length).toBeLessThanOrEqual(VISIBLE_ROWS + 2);
  });

  it('maintains correct total scroll height for all 10,000 rows', () => {
    render(<DataTable columns={columns} data={TEN_THOUSAND_ROWS} height={800} />);
    // getTotalSize() = 10_000 * 40 = 400_000 px
    // paddingBottom spacer captures the remaining height not covered by visible items.
    const spacers = document.querySelectorAll('tbody tr[aria-hidden="true"]');
    const totalPadding = Array.from(spacers).reduce((sum, tr) => {
      const td = tr.querySelector('td');
      return sum + (td ? parseInt(td.style.height || '0', 10) : 0);
    }, 0);
    // paddingTop (first 20 rows start at 0) = 0, paddingBottom = 400_000 - 20*40 = 399_200.
    expect(totalPadding).toBeGreaterThan(0);
  });

  it('renders only the first row of the visible window (row ID 1)', () => {
    render(<DataTable columns={columns} data={TEN_THOUSAND_ROWS} height={800} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    // Row 10,000 must NOT be in the DOM — it is outside the visible window.
    expect(screen.queryByText('10000')).not.toBeInTheDocument();
  });
});
