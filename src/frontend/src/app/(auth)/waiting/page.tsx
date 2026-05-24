'use client';

import { Spinner } from '@/app/components/ui';
import { useSession } from '@/app/hooks/useSession';

// TODO(NUF-4): poll `/api/auth/me` so the page auto-advances when an owner
// assigns this user to an organisation. For NUF-3 this page is a static
// holding screen.
export default function WaitingPage() {
  const { user } = useSession();

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-line bg-surface p-8 text-center shadow-xl">
      <Spinner size="md" />
      <h1 className="text-xl font-semibold">Waiting to be assigned</h1>
      <p className="max-w-md text-sm text-muted">
        Your account is ready, but you&apos;re not part of an organisation yet.
        Ask the owner of your team to add{' '}
        <strong>{user?.email ?? 'your email'}</strong> from the Members page in
        StackSift.
      </p>
    </div>
  );
}
