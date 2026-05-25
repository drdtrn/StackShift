'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { invalidateBearerCache } from '@/app/lib/api-client';
import { useToastStore } from '@/app/hooks/useToastStore';
import type { CreateOrganisationInput } from '@/app/lib/schemas/organisation';
import type { Organization } from '@/app/types';

class CreateOrgError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'CreateOrgError';
    this.status = status;
  }
}

export function useCreateOrganisation() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const addToast = useToastStore((s) => s.addToast);

  const mutation = useMutation<Organization, CreateOrgError, CreateOrganisationInput>({
    mutationFn: async (input) => {
      const res = await fetch('/api/onboarding/create-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        let message = 'create_org_failed';
        try {
          const data = (await res.json()) as { error?: string; title?: string };
          message = data.error ?? data.title ?? message;
        } catch {
          // body wasn't JSON; keep the default message
        }
        throw new CreateOrgError(message, res.status);
      }

      return res.json() as Promise<Organization>;
    },

    onSuccess: async () => {
      // Pair the cache invalidation with the bearer-cache reset (NUF-4): the
      // 55 s in-memory bearer cache would otherwise re-serve the old JWT
      // (without organization_id) and OrgGuard would bounce the user back to
      // /onboarding even though the BFF already rotated the session cookie.
      invalidateBearerCache();
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });

      addToast({
        variant: 'success',
        message: 'Welcome to StackSift! Your organisation has been created.',
      });

      router.push('/');
    },

    onError: (error) => {
      if (error.status === 409) {
        addToast({
          variant: 'error',
          message: 'You already belong to an organisation, or that name is taken.',
        });
        return;
      }
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
