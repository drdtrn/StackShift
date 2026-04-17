import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastContainer } from '../Toast';
import { useToastStore } from '@/app/hooks/useToastStore';

// Framer Motion mock
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, layout: _layout, initial: _initial, animate: _animate, exit: _exit, transition: _transition, ...props }: React.HTMLAttributes<HTMLDivElement> & { exit?: unknown; initial?: unknown; animate?: unknown; transition?: unknown; layout?: unknown }) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Reset Zustand store between tests so toasts don't bleed across.
beforeEach(() => {
  useToastStore.getState().clearAll();
});

describe('ToastContainer + useToastStore', () => {
  it('renders nothing when there are no toasts', () => {
    render(<ToastContainer />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders a toast after addToast is called', () => {
    render(<ToastContainer />);
    act(() => {
      useToastStore.getState().addToast({ variant: 'success', message: 'Saved!' });
    });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Saved!')).toBeInTheDocument();
  });

  it('renders multiple toasts stacked', () => {
    render(<ToastContainer />);
    act(() => {
      useToastStore.getState().addToast({ variant: 'success', message: 'First' });
      useToastStore.getState().addToast({ variant: 'error', message: 'Second' });
    });
    expect(screen.getAllByRole('alert')).toHaveLength(2);
  });

  it('removes a toast when the close button is clicked', async () => {
    render(<ToastContainer />);
    act(() => {
      useToastStore.getState().addToast({ variant: 'info', message: 'Hello' });
    });
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('removeToast removes only the targeted toast', () => {
    render(<ToastContainer />);
    let id2 = '';
    act(() => {
      useToastStore.getState().addToast({ variant: 'success', message: 'Keep me' });
      id2 = useToastStore.getState().addToast({ variant: 'error', message: 'Remove me' });
    });
    act(() => {
      useToastStore.getState().removeToast(id2);
    });
    expect(screen.getByText('Keep me')).toBeInTheDocument();
    expect(screen.queryByText('Remove me')).not.toBeInTheDocument();
  });

  it('error variant uses role=alert with aria-live=assertive', () => {
    render(<ToastContainer />);
    act(() => {
      useToastStore.getState().addToast({ variant: 'error', message: 'Something broke' });
    });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
  });

  it('success variant uses aria-live=polite', () => {
    render(<ToastContainer />);
    act(() => {
      useToastStore.getState().addToast({ variant: 'success', message: 'Done!' });
    });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'polite');
  });
});
