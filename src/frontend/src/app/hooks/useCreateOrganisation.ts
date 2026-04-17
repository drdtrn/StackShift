'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useToastStore } from '@/app/hooks/useToastStore';
import type { CreateOrganisationInput } from '@/app/lib/schemas/organisation';
import type { Organization } from '@/app/types';

// ---------------------------------------------------------------------------
// useCreateOrganisation
//
// TanStack Query mutation hook for the US-03 onboarding form.
//
// Mutation flow:
//   POST /api/onboarding/create-org   ← sends { name }
//     │
//     ├── 201 Created → { id, name, slug, createdAt, updatedAt }
//     │     The Route Handler also replaces the session cookie with an
//     │     updated JWT that includes the new organization_id claim.
//     │
//     └── 4xx → { error, issues? }
//
// onSuccess:
//   1. invalidateQueries(['auth', 'me']) — forces useSession to refetch.
//      The session cookie now has organizationId set, so /api/auth/me will
//      return a user with organizationId non-null. OnboardingGuard will pass.
//   2. Show "Welcome to StackSift!" toast.
//   3. Navigate to '/' — the dashboard home.
//
//   IMPORTANT: `invalidateQueries` is awaited before navigating so the
//   QueryClient has the fresh session before OnboardingGuard re-evaluates.
//   Without await, the guard re-runs before the refetch completes and
//   triggers another /onboarding redirect (infinite loop).
//
// onError:
//   Show a generic error toast. The mutation caller can also inspect the
//   error object for more specific handling.
// ---------------------------------------------------------------------------

export function useCreateOrganisation() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const addToast = useToastStore((s) => s.addToast);

  const mutation = useMutation<Organization, Error, CreateOrganisationInput>({
    mutationFn: async (input) => {
      const res = await fetch('/api/onboarding/create-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error: string };
        throw new Error(data.error ?? 'create_org_failed');
      }

      return res.json() as Promise<Organization>;
    },

    onSuccess: async () => {
      // Await the invalidation so /api/auth/me refetch completes before we
      // navigate. Once the session has organizationId, OnboardingGuard passes.
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });

      addToast({
        variant: 'success',
        message: 'Welcome to StackSift! Your organisation has been created.',
      });

      router.push('/');
    },

    onError: () => {
      addToast({
        variant: 'error',
        message: 'Could not create organisation. Please try again.',
      });
    },
  });

  return {
    createOrganisation: mutation.mutate,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}
