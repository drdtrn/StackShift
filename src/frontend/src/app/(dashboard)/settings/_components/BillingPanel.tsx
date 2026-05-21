'use client';

import { useSubscription } from '@/app/hooks/queries/use-subscription';
import { useUpgradePlan } from '@/app/hooks/mutations/use-upgrade-plan';
import { useBillingPortal } from '@/app/hooks/mutations/use-billing-portal';
import { Button } from '@/app/components/ui/Button';
import { Card, CardBody } from '@/app/components/ui/Card';
import { Skeleton } from '@/app/components/ui/Skeleton';
import { Spinner } from '@/app/components/ui/Spinner';

export function BillingPanel() {
  const sub = useSubscription();
  const upgrade = useUpgradePlan();
  const portal = useBillingPortal();

  if (sub.isPending) {
    return (
      <Card>
        <CardBody className="flex flex-col gap-3">
          <Skeleton className="h-6 w-32 rounded" />
          <Skeleton className="h-10 w-40 rounded" />
        </CardBody>
      </Card>
    );
  }

  if (sub.isError || !sub.data) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-red-500">
            Could not load subscription details. Refresh the page to try again.
          </p>
        </CardBody>
      </Card>
    );
  }

  const { plan, status, currentPeriodEnd, cancelAtPeriodEnd, hasStripeCustomer } = sub.data;
  const isFree = plan === 'free';
  const isPaid = !isFree;
  const formattedPeriodEnd = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  const launchCheckout = (target: 'indie' | 'team') =>
    upgrade.mutate(
      { plan: target },
      {
        onSuccess: ({ url }) => {
          window.location.href = url;
        },
      },
    );

  const launchPortal = () =>
    portal.mutate(undefined, {
      onSuccess: ({ url }) => {
        window.location.href = url;
      },
    });

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardBody className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold">Current plan</h2>
            <p className="text-3xl font-bold capitalize mt-2">{plan}</p>
          </div>

          {status === 'pastDue' && (
            <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              Your last payment failed. Update your card via the customer portal
              to keep your subscription active.
            </div>
          )}

          {cancelAtPeriodEnd && formattedPeriodEnd && (
            <p className="text-sm text-muted">
              Cancels on <span className="font-medium text-primary">{formattedPeriodEnd}</span>.
            </p>
          )}

          {!cancelAtPeriodEnd && isPaid && formattedPeriodEnd && (
            <p className="text-sm text-muted">
              Renews on <span className="font-medium text-primary">{formattedPeriodEnd}</span>.
            </p>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            {isFree && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => launchCheckout('indie')}
                  disabled={upgrade.isPending}
                >
                  {upgrade.isPending && upgrade.variables?.plan === 'indie' ? (
                    <Spinner size="sm" />
                  ) : null}
                  Upgrade to Indie — $19/mo
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => launchCheckout('team')}
                  disabled={upgrade.isPending}
                >
                  {upgrade.isPending && upgrade.variables?.plan === 'team' ? (
                    <Spinner size="sm" />
                  ) : null}
                  Upgrade to Team — $79/mo
                </Button>
              </>
            )}
            {isPaid && hasStripeCustomer && (
              <Button
                type="button"
                variant="secondary"
                onClick={launchPortal}
                disabled={portal.isPending}
              >
                {portal.isPending ? <Spinner size="sm" /> : null}
                Manage subscription
              </Button>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
