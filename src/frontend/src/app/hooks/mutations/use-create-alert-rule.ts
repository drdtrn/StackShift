'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useToastStore } from '@/app/hooks/useToastStore';
import { queryKeys } from '@/app/lib/query-keys';
import type { AlertRuleFormInput } from '@/app/lib/schemas/alert-rule';
import type { AlertRule } from '@/app/types';

// ---------------------------------------------------------------------------
// useCreateAlertRule
//
// TanStack Query mutation for the Alert Rule Builder (US-08).
//
// On success:
//   - Invalidates queryKeys.alerts.all — the alerts list page refetches and
//     shows the newly created rule. Alerts and AlertRules share the same cache
//     domain, so this invalidation covers both.
//   - Shows success toast.
//   - Redirects to /alerts (list page, not detail, since AlertRule detail
//     pages aren't built yet in this sprint).
// ---------------------------------------------------------------------------

export function useCreateAlertRule() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const addToast = useToastStore((s) => s.addToast);

  const mutation = useMutation<AlertRule, Error, AlertRuleFormInput>({
    mutationFn: async (input) => {
      const res = await fetch('/api/alert-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error: string };
        throw new Error(data.error ?? 'create_alert_rule_failed');
      }

      return res.json() as Promise<AlertRule>;
    },

    onSuccess: async (rule) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.alerts.all });

      addToast({
        variant: 'success',
        message: `Alert rule "${rule.name}" created successfully.`,
      });

      router.push('/alerts');
    },

    onError: (err) => {
      addToast({
        variant: 'error',
        message: err.message === 'unauthenticated'
          ? 'Your session expired. Please log in again.'
          : 'Failed to create alert rule. Please try again.',
      });
    },
  });

  return {
    createAlertRule: mutation.mutate,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}
