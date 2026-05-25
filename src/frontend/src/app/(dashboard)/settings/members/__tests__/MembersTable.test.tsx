import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MembersTable } from '../_components/MembersTable';
import type { Member } from '@/app/types';

const baseRow = (over: Partial<Member>): Member => ({
  id: 'u1',
  email: 'u@example.com',
  displayName: 'User',
  role: 'member',
  invitedByUserId: null,
  invitedByDisplayName: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  lastLoginAt: null,
  ...over,
});

describe('MembersTable', () => {
  it('renders the empty state when there are no members', () => {
    render(
      <MembersTable
        members={[]}
        currentUserId={undefined}
        onChangeRole={jest.fn()}
        onRemove={jest.fn()}
      />,
    );
    expect(screen.getByText(/no members yet/i)).toBeInTheDocument();
  });

  it('renders rows + emits onChangeRole with (userId, role)', async () => {
    const onChangeRole = jest.fn();
    render(
      <MembersTable
        members={[baseRow({ id: 'u1', role: 'member' })]}
        currentUserId="someone-else"
        onChangeRole={onChangeRole}
        onRemove={jest.fn()}
      />,
    );

    const select = screen.getByLabelText(/role for/i);
    await userEvent.selectOptions(select, 'admin');
    expect(onChangeRole).toHaveBeenCalledWith('u1', 'admin');
  });

  it('emits onRemove with userId', async () => {
    const onRemove = jest.fn();
    render(
      <MembersTable
        members={[baseRow({ id: 'u1', role: 'member', displayName: 'Bob' })]}
        currentUserId="someone-else"
        onChangeRole={jest.fn()}
        onRemove={onRemove}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /remove bob/i }));
    expect(onRemove).toHaveBeenCalledWith('u1');
  });

  it('last-owner guard disables non-owner roles and hides remove', () => {
    render(
      <MembersTable
        members={[baseRow({ id: 'u1', role: 'owner', displayName: 'Sole' })]}
        currentUserId="u1"
        onChangeRole={jest.fn()}
        onRemove={jest.fn()}
      />,
    );

    const select = screen.getByLabelText(/role for sole/i) as HTMLSelectElement;
    const options = within(select).getAllByRole('option') as HTMLOptionElement[];
    const ownerOpt = options.find((o) => o.value === 'owner');
    const adminOpt = options.find((o) => o.value === 'admin');
    expect(ownerOpt?.disabled).toBe(false);
    expect(adminOpt?.disabled).toBe(true);

    expect(screen.queryByRole('button', { name: /remove sole|leave/i })).toBeNull();
  });
});
