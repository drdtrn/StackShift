import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import type { AccountDeletionAccepted } from '@/app/lib/account-schemas';

interface DeletionState {
  isSuccess: boolean;
  isError: boolean;
  isPending: boolean;
  data: AccountDeletionAccepted | undefined;
  mutate: jest.Mock;
}

const mockMutate = jest.fn();
const mockSignOut = jest.fn();

let deletionState: DeletionState = {
  isSuccess: false,
  isError: false,
  isPending: false,
  data: undefined,
  mutate: mockMutate,
};

jest.mock('@/app/hooks/mutations/use-request-account-deletion', () => ({
  useRequestAccountDeletion: () => deletionState,
}));

jest.mock('@/app/hooks/useSignOut', () => ({
  useSignOut: () => ({ signOut: mockSignOut, isLoading: false }),
}));

import { AccountDeletePanel } from '../_components/AccountDeletePanel';

describe('AccountDeletePanel', () => {
  beforeEach(() => {
    mockMutate.mockReset();
    mockSignOut.mockReset();
    deletionState = {
      isSuccess: false,
      isError: false,
      isPending: false,
      data: undefined,
      mutate: mockMutate,
    };
  });

  it('enables deletion only after the exact confirmation phrase, then calls mutate', () => {
    render(<AccountDeletePanel />);

    const button = screen.getByRole('button', { name: /delete my account/i });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'DELETE my account' } });
    expect(button).toBeEnabled();

    fireEvent.click(button);
    expect(mockMutate).toHaveBeenCalledWith('DELETE my account');
  });

  it('surfaces the cancellation token and signs out on success', () => {
    deletionState = {
      isSuccess: true,
      isError: false,
      isPending: false,
      data: {
        requestId: '00000000-0000-0000-0000-000000000001',
        gracePeriodEndsAt: '2026-07-01T00:00:00Z',
        cancellationToken: 'cancel-tok-123',
      },
      mutate: mockMutate,
    };

    render(<AccountDeletePanel />);
    expect(screen.getByText('cancel-tok-123')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(mockSignOut).toHaveBeenCalled();
  });
});
