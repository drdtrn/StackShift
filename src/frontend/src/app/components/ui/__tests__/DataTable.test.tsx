import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createColumnHelper } from '@tanstack/react-table';
import { DataTable } from '../DataTable';

// Framer Motion mock (used by Dropdown inside DataTable)
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { exit?: unknown; initial?: unknown; animate?: unknown; transition?: unknown }) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// useVirtualizer mock — in jsdom there is no real scroll container, so the
// virtualizer returns no virtual items. We mock it to return all rows so
// tests can assert on rendered cells.
jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({ index: i, start: i * 40, end: (i + 1) * 40 })),
    getTotalSize: () => count * 40,
    measureElement: () => {},
  }),
}));

interface Person {
  id: number;
  name: string;
  role: string;
}

const columnHelper = createColumnHelper<Person>();

const columns = [
  columnHelper.accessor('name', { header: 'Name' }),
  columnHelper.accessor('role', { header: 'Role' }),
];

const data: Person[] = [
  { id: 1, name: 'Alice', role: 'Engineer' },
  { id: 2, name: 'Bob', role: 'Admin' },
  { id: 3, name: 'Carol', role: 'Viewer' },
];

describe('DataTable', () => {
  it('renders column headers', () => {
    render(<DataTable columns={columns} data={data} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();
  });

  it('renders all data rows', () => {
    render(<DataTable columns={columns} data={data} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Carol')).toBeInTheDocument();
  });

  it('shows EmptyState when data is empty', () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        emptyState={{ title: 'No people found' }}
      />,
    );
    expect(screen.getByRole('heading', { name: 'No people found' })).toBeInTheDocument();
  });

  it('shows Spinner overlay when loading is true', () => {
    render(<DataTable columns={columns} data={data} loading />);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('renders a Columns toggle button', () => {
    render(<DataTable columns={columns} data={data} />);
    // The Dropdown renders a wrapper button (className="contents") + the inner Button.
    // At least one element matching "columns" must be in the document.
    const matches = screen.getAllByRole('button', { name: /columns/i });
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders selection checkboxes when selectable is true', () => {
    render(<DataTable columns={columns} data={data} selectable />);
    // One checkbox per row + one "select all" in the header.
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(data.length + 1);
  });

  it('renders pagination buttons when pagination prop is provided', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        pagination={{
          hasNextPage: true,
          hasPrevPage: false,
          onNextPage: jest.fn(),
          onPrevPage: jest.fn(),
        }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument();
  });

  it('disables Previous button when hasPrevPage is false', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        pagination={{
          hasNextPage: true,
          hasPrevPage: false,
          onNextPage: jest.fn(),
          onPrevPage: jest.fn(),
        }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  });

  it('calls onNextPage when Next is clicked', async () => {
    const onNextPage = jest.fn();
    render(
      <DataTable
        columns={columns}
        data={data}
        pagination={{
          hasNextPage: true,
          hasPrevPage: false,
          onNextPage,
          onPrevPage: jest.fn(),
        }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onNextPage).toHaveBeenCalledTimes(1);
  });
});
