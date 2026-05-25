'use client';

import { useState } from 'react';
import { Button, Skeleton } from '@/app/components/ui';
import { useAuthStore } from '@/app/hooks/useAuthStore';
import { useMembers } from '@/app/hooks/queries';
import {
  useAddOrInviteMember,
  useRemoveMember,
  useUpdateMemberRole,
} from '@/app/hooks/mutations';
import type { UserRole } from '@/app/types';
import { MembersTable } from './_components/MembersTable';
import { AddOrInviteByEmailDialog } from './_components/AddOrInviteByEmailDialog';

export default function MembersPage() {
  const user = useAuthStore((s) => s.user);
  const orgId = user?.organizationId ?? null;
  const isOwner = user?.role === 'owner';

  const membersQuery = useMembers(orgId);
  const addOrInvite = useAddOrInviteMember(orgId);
  const updateRole = useUpdateMemberRole(orgId);
  const removeMember = useRemoveMember(orgId);

  const [addOpen, setAddOpen] = useState(false);

  if (!isOwner) {
    return (
      <div className="rounded-lg border border-line bg-surface p-6 text-sm text-muted">
        Only organisation owners can manage members.
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Team members</h2>
          <p className="text-sm text-muted">Add teammates by email; assign roles; remove access.</p>
        </div>
        <Button type="button" variant="primary" onClick={() => setAddOpen(true)}>
          Add member by email
        </Button>
      </header>

      {membersQuery.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : membersQuery.isError ? (
        <div className="rounded-lg border border-line bg-surface p-6 text-sm text-red-500">
          Could not load members. Try refreshing the page.
        </div>
      ) : (
        <MembersTable
          members={membersQuery.data ?? []}
          currentUserId={user?.id}
          onChangeRole={(userId, newRole: UserRole) =>
            updateRole.mutate({ userId, newRole })
          }
          onRemove={(userId) => removeMember.mutate({ userId })}
        />
      )}

      <AddOrInviteByEmailDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={(values) => addOrInvite.mutateAsync(values)}
        submitting={addOrInvite.isPending}
      />
    </section>
  );
}
