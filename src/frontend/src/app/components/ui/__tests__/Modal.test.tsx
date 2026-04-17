import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '../Modal';

// Framer Motion mock — replaces animated wrappers with plain divs so jsdom
// doesn't complain about missing Web Animations API.
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { exit?: unknown; initial?: unknown; animate?: unknown; transition?: unknown }) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const renderModal = (open = true, onClose = jest.fn()) =>
  render(
    <Modal open={open} onClose={onClose} title="Confirm Action">
      <p>Are you sure?</p>
      <button>Confirm</button>
    </Modal>,
  );

describe('Modal', () => {
  it('renders the modal when open is true', () => {
    renderModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    renderModal(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the title', () => {
    renderModal();
    expect(screen.getByRole('heading', { name: 'Confirm Action' })).toBeInTheDocument();
  });

  it('renders children content', () => {
    renderModal();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('has role="dialog" and aria-modal="true"', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('links aria-labelledby to the title heading', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    const labelId = dialog.getAttribute('aria-labelledby');
    const title = screen.getByRole('heading', { name: 'Confirm Action' });
    expect(title.getAttribute('id')).toBe(labelId);
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = jest.fn();
    render(
      <Modal open onClose={onClose} title="Test">
        <p>Content</p>
      </Modal>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Close modal' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', async () => {
    const onClose = jest.fn();
    renderModal(true, onClose);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
