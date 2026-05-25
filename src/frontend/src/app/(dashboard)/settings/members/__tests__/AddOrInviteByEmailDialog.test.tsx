import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddOrInviteByEmailDialog } from '../_components/AddOrInviteByEmailDialog';

// Strip Framer Motion props that jsdom doesn't understand. The mock returns
// plain HTML elements per tag name; the animation props are filtered out so
// React doesn't warn about unknown DOM attributes.
const STRIP_PROPS = new Set([
  'initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap', 'variants', 'layout',
]);

function stripMotionProps(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(props)) {
    if (!STRIP_PROPS.has(key)) out[key] = props[key];
  }
  return out;
}

jest.mock('framer-motion', () => {
  const proxy = new Proxy(
    {},
    {
      get: (_target, key) => {
        const tag = String(key);
        function MotionTag(props: Record<string, unknown>) {
          const { children, ...rest } = props as { children?: React.ReactNode };
          return React.createElement(tag, stripMotionProps(rest), children);
        }
        MotionTag.displayName = `MotionMock(${tag})`;
        return MotionTag;
      },
    },
  );
  function AnimatePresence({ children }: { children: React.ReactNode }) {
    return React.createElement(React.Fragment, null, children);
  }
  return { motion: proxy, AnimatePresence };
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
