'use client';

import { useMemo } from 'react';
import { Button } from '@/app/components/ui';
import type { Member, UserRole } from '@/app/types';

interface MembersTableProps {
  members: Member[];
  currentUserId: string | undefined;
  onChangeRole: (userId: string, role: UserRole) => void;
  onRemove: (userId: string) => void;
}

const ROLES: UserRole[] = ['owner', 'admin', 'member', 'viewer'];

export function MembersTable({
  members,
  currentUserId,
  onChangeRole,
  onRemove,
}: MembersTableProps) {
  const ownerCount = useMemo(
    () => members.filter((m) => m.role === 'owner').length,
    [members],
  );

  if (members.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-elevated p-8 text-center text-sm text-muted">
        No members yet. Add a teammate by email to get started.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <table className="w-full text-sm">
        <thead className="bg-elevated text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3 font-medium">Member</th>
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {members.map((member) => {
            const isLastOwner = member.role === 'owner' && ownerCount <= 1;
            const isSelf = member.id === currentUserId;
            return (
              <tr key={member.id}>
                <td className="px-4 py-3">
                  <div className="font-medium text-primary">{member.displayName}</div>
                  <div className="text-xs text-muted">{member.email}</div>
                  {member.invitedByDisplayName ? (
                    <div className="mt-1 text-xs text-muted">
                      Invited by {member.invitedByDisplayName}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <select
                    aria-label={`Role for ${member.displayName}`}
                    className="rounded-md border border-line bg-elevated px-2 py-1 text-sm capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    value={member.role}
                    onChange={(e) => onChangeRole(member.id, e.target.value as UserRole)}
                  >
                    {ROLES.map((role) => (
                      <option
                        key={role}
                        value={role}
                        disabled={isLastOwner && role !== 'owner'}
                      >
                        {role}
                      </option>
                    ))}
                  </select>
                  {isLastOwner ? (
                    <p className="mt-1 text-xs text-muted">
                      Promote another member to owner before changing this role.
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-right">
                  {!isLastOwner ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => onRemove(member.id)}
                      aria-label={`Remove ${member.displayName}`}
                    >
                      {isSelf ? 'Leave' : 'Remove'}
                    </Button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
