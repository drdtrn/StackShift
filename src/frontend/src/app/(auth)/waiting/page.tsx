'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Spinner } from '@/app/components/ui';
import { useAuthStore } from '@/app/hooks/useAuthStore';
import { invalidateBearerCache } from '@/app/lib/api-client';

const POLL_INTERVAL_MS = 30_000;

export default function WaitingPage() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const qc = useQueryClient();
  const [isChecking, setIsChecking] = useState(false);

  const refetchSession = useCallback(async () => {
    setIsChecking(true);
    try {
      await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      });
    } catch {
      // ignore network errors — the invalidation below will still surface any change
    }
    invalidateBearerCache();
    qc.invalidateQueries({ queryKey: ['auth', 'me'] });
    setIsChecking(false);
  }, [qc]);

  useEffect(() => {
    const id = setInterval(refetchSession, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refetchSession]);

  useEffect(() => {
    if (user?.organizationId) router.replace('/');
  }, [user?.organizationId, router]);

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
      <p className="text-xs text-muted">
        You can leave this page open — we&apos;ll check every 30 seconds.
      </p>
      <button
        type="button"
        onClick={refetchSession}
        disabled={isChecking}
        className="text-sm text-blue-500 underline hover:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isChecking ? 'Checking…' : 'Check now'}
      </button>
    </div>
  );
}
