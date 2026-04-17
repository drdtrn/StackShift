import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('renders the title', () => {
    render(<EmptyState title="No logs yet" />);
    expect(screen.getByRole('heading', { name: 'No logs yet' })).toBeInTheDocument();
  });

  it('renders the description when provided', () => {
    render(
      <EmptyState
        title="No incidents"
        description="Once an alert fires, incidents will appear here."
      />,
    );
    expect(
      screen.getByText('Once an alert fires, incidents will appear here.'),
    ).toBeInTheDocument();
  });

  it('does not render description when not provided', () => {
    const { container } = render(<EmptyState title="No data" />);
    expect(container.querySelector('p')).not.toBeInTheDocument();
  });

  it('renders the CTA button when provided', () => {
    render(
      <EmptyState
        title="No projects"
        cta={{ label: 'Create project', onClick: jest.fn() }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Create project' })).toBeInTheDocument();
  });

  it('calls the CTA onClick when button is clicked', async () => {
    const onClick = jest.fn();
    render(
      <EmptyState
        title="No projects"
        cta={{ label: 'Create project', onClick }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Create project' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not render a button when cta is not provided', () => {
    render(<EmptyState title="No data" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders the icon when provided', () => {
    render(
      <EmptyState
        title="No data"
        icon={<span data-testid="icon">📭</span>}
      />,
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });
});
