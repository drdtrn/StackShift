import { render, screen } from '@/app/test-utils';
import userEvent from '@testing-library/user-event';
import { ApiKeyRevealModal } from '../ApiKeyRevealModal';

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('ApiKeyRevealModal', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
    });
  });

  it('requires explicit confirmation before completing', async () => {
    const onConfirmed = jest.fn();
    render(
      <ApiKeyRevealModal
        open
        apiKey="ss_abcdefghijklmnopqrstuvwxyz123456"
        keyPrefix="ss_abcde"
        onConfirmed={onConfirmed}
      />,
    );

    const done = screen.getByRole('button', { name: 'Done' });
    expect(done).toBeDisabled();

    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(done);

    expect(onConfirmed).toHaveBeenCalledTimes(1);
  });

  it('copies the cleartext key', async () => {
    render(
      <ApiKeyRevealModal
        open
        apiKey="ss_abcdefghijklmnopqrstuvwxyz123456"
        keyPrefix="ss_abcde"
        onConfirmed={jest.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'ss_abcdefghijklmnopqrstuvwxyz123456',
    );
  });
});
