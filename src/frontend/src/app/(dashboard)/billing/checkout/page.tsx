'use client';

import { useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUpgradePlan, type UpgradePlanTier } from '@/app/hooks/mutations/use-upgrade-plan';
import { Spinner } from '@/app/components/ui/Spinner';

function CheckoutBootstrap() {
  const params = useSearchParams();
  const router = useRouter();
  const upgrade = useUpgradePlan();
  const launchedRef = useRef(false);

  const planParam = params.get('plan')?.toLowerCase() ?? '';
  const fromParam = params.get('from');

  const isValidPlan = planParam === 'indie' || planParam === 'team';

  useEffect(() => {
    if (!isValidPlan) {
      router.replace('/settings/billing');
      return;
    }
    if (launchedRef.current) return;
    launchedRef.current = true;

    upgrade.mutate(
      { plan: planParam as UpgradePlanTier, from: fromParam },
      {
        onSuccess: ({ url }) => {
          window.location.href = url;
        },
      },
    );
  }, [isValidPlan, planParam, fromParam, upgrade, router]);

  if (!isValidPlan) return null;

  if (upgrade.isError) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
        <p className="text-sm text-red-500">
          Could not start checkout. Please try again from{' '}
          <a href="/settings/billing" className="underline">
            settings → billing
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-[40vh] items-center justify-center gap-3"
      aria-busy="true"
      aria-label="Redirecting to secure checkout"
    >
      <Spinner size="lg" />
      <p className="text-sm text-muted">Redirecting to secure checkout…</p>
    </div>
  );
}

export default function CheckoutBootstrapPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Spinner size="lg" />
        </div>
      }
    >
      <CheckoutBootstrap />
    </Suspense>
  );
}
