'use client';

import { useState, useRef, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
  type VisibilityState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronUp, ChevronDown, ChevronsUpDown, Columns3 } from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { Dropdown } from './Dropdown';
import { Spinner } from './Spinner';
import { EmptyState } from './EmptyState';
import { Button } from './Button';

/* ─── Types ─────────────────────────────────────────────────────────────────── */

export interface DataTablePagination {
  /** Whether a next page exists. */
  hasNextPage: boolean;
  /** Whether a previous page exists. */
  hasPrevPage: boolean;
  /** Called when user clicks "Next". */
  onNextPage: () => void;
  /** Called when user clicks "Previous". */
  onPrevPage: () => void;
  /** Human-readable label shown between the buttons (e.g. "Showing 1–50 of 1,204"). */
  label?: string;
}

export interface DataTableProps<TData> {
  /**
   * Column definitions from `@tanstack/react-table`.
   * Use `createColumnHelper<TData>()` to build these with full type inference.
   */
  columns: ColumnDef<TData, unknown>[];
  /** The data array to render. Can be empty (shows EmptyState). */
  data: TData[];
  /** When true, shows a centered Spinner overlay instead of data rows. */
  loading?: boolean;
  /** Title and description for the empty state when `data` is empty. */
  emptyState?: { title: string; description?: string };
  /** Pagination controls. Omit for non-paginated tables. */
  pagination?: DataTablePagination;
  /** Enables row selection checkboxes. */
  selectable?: boolean;
  /** Callback with the current selection map when rows are selected/deselected. */
  onSelectionChange?: (selection: RowSelectionState) => void;
  /**
   * Estimated height of each row in pixels.
   * The virtualizer uses this to calculate the total scroll height before rows
   * are measured. Accuracy affects scroll bar fidelity — 40px is typical for
   * single-line rows (log table). Default: 40.
   */
  estimatedRowHeight?: number;
  /**
   * Fixed height of the scrollable viewport in pixels.
   * Required for virtualisation — the container must have a known height.
   * Default: 600 (suitable for most dashboard panels).
   */
  height?: number;
  className?: string;
}

/* ─── Sort icon helper ───────────────────────────────────────────────────────── */

function SortIcon({ direction }: { direction: 'asc' | 'desc' | false }) {
  if (direction === 'asc') return <ChevronUp className="h-3.5 w-3.5" aria-label="sorted ascending" />;
  if (direction === 'desc') return <ChevronDown className="h-3.5 w-3.5" aria-label="sorted descending" />;
  return <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" aria-label="unsorted" />;
}

/* ─── DataTable ──────────────────────────────────────────────────────────────── */

/**
 * Virtualised, sortable, selectable data table for high-volume data.
 *
 * ## Virtualisation
 * Uses `@tanstack/react-virtual`'s `useVirtualizer`. Instead of rendering all
 * N rows as DOM nodes, the virtualizer renders only the rows currently visible
 * in the scroll viewport plus a small overscan buffer. The total scroll height
 * is maintained by a single `paddingTop` + `paddingBottom` spacer on the tbody,
 * so the scrollbar behaves correctly even with 100,000 rows.
 *
 * This is critical for the Log Explorer where a single query may return 50,000+
 * entries. Without virtualisation, the DOM would have 50k+ nodes, freezing the
 * browser.
 *
 * ## Column visibility
 * A `Dropdown` in the toolbar toggles column visibility. The visibility state
 * is maintained in `@tanstack/react-table`'s `columnVisibility` state — the
 * table re-renders only the visible columns, saving both DOM nodes and layout work.
 *
 * ## Row selection
 * When `selectable` is true, a checkbox column is prepended. `RowSelectionState`
 * is a `{ [rowId]: boolean }` map. The parent receives it via `onSelectionChange`
 * and can use it to build bulk-action payloads.
 *
 * ## Sorting
 * Client-side sorting via `getSortedRowModel`. For server-side sorting (Sprint 3),
 * replace `getSortedRowModel` with `manualSorting: true` and call the API with
 * the `sorting` state as query params.
 *
 * ## Sticky header
 * `position: sticky; top: 0` on the `<thead>`. The table wrapper has
 * `overflow-y: auto` so only the body scrolls while the header stays visible.
 */
export function DataTable<TData>({
  columns: columnDefs,
  data,
  loading = false,
  emptyState = { title: 'No data' },
  pagination,
  selectable = false,
  onSelectionChange,
  estimatedRowHeight = 40,
  height = 600,
  className,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  // Build the selection checkbox column if selectable is enabled.
  const selectionColumn: ColumnDef<TData, unknown> = {
    id: '__select__',
    header: ({ table }) => (
      <input
        type="checkbox"
        checked={table.getIsAllPageRowsSelected()}
        ref={(el) => {
          if (el) el.indeterminate = table.getIsSomePageRowsSelected();
        }}
        onChange={table.getToggleAllPageRowsSelectedHandler()}
        aria-label="Select all rows"
        className="rounded border-zinc-300 dark:border-zinc-600"
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        checked={row.getIsSelected()}
        onChange={row.getToggleSelectedHandler()}
        aria-label={`Select row ${row.index + 1}`}
        className="rounded border-zinc-300 dark:border-zinc-600"
      />
    ),
    size: 40,
    enableSorting: false,
  };

  const columns = selectable ? [selectionColumn, ...columnDefs] : columnDefs;

  const table = useReactTable({
    data,
    columns,
    state: { sorting, rowSelection, columnVisibility },
    onSortingChange: setSorting,
    onRowSelectionChange: (updater) => {
      const next = typeof updater === 'function' ? updater(rowSelection) : updater;
      setRowSelection(next);
      onSelectionChange?.(next);
    },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const { rows } = table.getRowModel();

  // Virtualizer — key to performance.
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: useCallback(() => estimatedRowHeight, [estimatedRowHeight]),
    overscan: 10, // render 10 extra rows above/below viewport to prevent white flash on fast scroll
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalHeight = virtualizer.getTotalSize();
  // Padding spacers maintain the correct scroll height without rendering all rows.
  const paddingTop = virtualItems.length > 0 ? (virtualItems[0]?.start ?? 0) : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? totalHeight - (virtualItems[virtualItems.length - 1]?.end ?? 0)
      : 0;

  // Column visibility dropdown items.
  const visibilityItems = table
    .getAllLeafColumns()
    .filter((col) => col.id !== '__select__')
    .map((col) => ({
      id: col.id,
      label: typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id,
    }));

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          {selectable && Object.keys(rowSelection).length > 0 && (
            <span>{Object.keys(rowSelection).length} selected</span>
          )}
        </div>

        {visibilityItems.length > 0 && (
          <Dropdown
            trigger={
              <Button variant="ghost" size="sm" className="gap-1.5">
                <Columns3 className="h-4 w-4" aria-hidden="true" />
                Columns
              </Button>
            }
            items={visibilityItems.map((item) => ({
              ...item,
              label: `${table.getColumn(item.id)?.getIsVisible() !== false ? '✓ ' : '  '}${item.label}`,
            }))}
            onSelect={(id) => {
              table.getColumn(id)?.toggleVisibility();
            }}
            align="right"
          />
        )}
      </div>

      {/* Table scroll container */}
      <div
        ref={scrollRef}
        style={{ height, overflowY: 'auto' }}
        className="rounded-md border border-zinc-200 dark:border-zinc-700 relative"
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-zinc-900/70 z-10">
            <Spinner size="lg" />
          </div>
        )}

        {!loading && data.length === 0 ? (
          <EmptyState
            title={emptyState.title}
            description={emptyState.description}
          />
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-[1] bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      scope="col"
                      style={{ width: header.getSize() }}
                      className={cn(
                        'px-3 py-2.5 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide whitespace-nowrap',
                        header.column.getCanSort() && 'cursor-pointer select-none hover:text-zinc-700 dark:hover:text-zinc-200',
                      )}
                      onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                      aria-sort={
                        header.column.getIsSorted() === 'asc'
                          ? 'ascending'
                          : header.column.getIsSorted() === 'desc'
                          ? 'descending'
                          : header.column.getCanSort()
                          ? 'none'
                          : undefined
                      }
                    >
                      {header.isPlaceholder ? null : (
                        <span className="inline-flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() && (
                            <SortIcon direction={header.column.getIsSorted()} />
                          )}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>

            <tbody>
              {/* Top spacer — represents rows above the viewport */}
              {paddingTop > 0 && (
                <tr aria-hidden="true">
                  <td style={{ height: paddingTop }} />
                </tr>
              )}

              {virtualItems.map((virtualRow) => {
                const row = rows[virtualRow.index];
                return (
                  <tr
                    key={row.id}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    className={cn(
                      'border-b border-zinc-100 dark:border-zinc-800',
                      'hover:bg-zinc-50 dark:hover:bg-zinc-800/50',
                      row.getIsSelected() && 'bg-blue-50 dark:bg-blue-950/30',
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-3 py-2 text-zinc-700 dark:text-zinc-300 whitespace-nowrap"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })}

              {/* Bottom spacer — represents rows below the viewport */}
              {paddingBottom > 0 && (
                <tr aria-hidden="true">
                  <td style={{ height: paddingBottom }} />
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
          <span>{pagination.label ?? ''}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={pagination.onPrevPage}
              disabled={!pagination.hasPrevPage}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={pagination.onNextPage}
              disabled={!pagination.hasNextPage}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
