import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddOrInviteByEmailDialog } from '../_components/AddOrInviteByEmailDialog';

// Strip Framer Motion props that jsdom doesn't understand.
jest.mock('framer-motion', () => {
  const React = require('react');
  return {
    motion: new Proxy(
      {},
      {
        get: (_target, key) => {
          const Tag = key as string;
          return React.forwardRef(
            (
              {
                children,
                initial: _i,
                animate: _a,
                exit: _e,
                transition: _t,
                whileHover: _wh,
                whileTap: _wt,
                ...rest
              }: Record<string, unknown> & { children?: React.ReactNode },
              ref: React.Ref<HTMLElement>,
            ) => React.createElement(Tag, { ...rest, ref }, children),
          );
        },
      },
    ),
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

describe('AddOrInviteByEmailDialog', () => {
  it('submits the email + role and closes', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    render(
      <AddOrInviteByEmailDialog
        open={true}
        onClose={onClose}
        onSubmit={onSubmit}
        submitting={false}
      />,
    );

    await act(async () => {
      await userEvent.type(screen.getByLabelText(/email/i), 'mate@example.com');
      await userEvent.selectOptions(screen.getByLabelText(/role/i), 'admin');
      await userEvent.click(screen.getByRole('button', { name: /send/i }));
    });

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ email: 'mate@example.com', role: 'admin' });
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows a Zod validation error for an invalid email', async () => {
    const onSubmit = jest.fn();
    render(
      <AddOrInviteByEmailDialog
        open={true}
        onClose={jest.fn()}
        onSubmit={onSubmit}
        submitting={false}
      />,
    );

    await act(async () => {
      await userEvent.type(screen.getByLabelText(/email/i), 'not-an-email');
      await userEvent.click(screen.getByRole('button', { name: /send/i }));
    });

    expect(await screen.findByText(/valid email address/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
