'use client';

import { Card, CardBody, CardHeader, Skeleton } from '@/app/components/ui';
import { useCurrentOrganization, useMembers, useProjects, useSubscription } from '@/app/hooks/queries';
import type { Organization } from '@/app/types';

const PLAN_PROJECT_LIMITS: Record<Organization['plan'], number | null> = {
  free: 1,
  indie: 5,
  team: null,
};

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function SettingsPage() {
  const organization = useCurrentOrganization();
  const projects = useProjects();
  const subscription = useSubscription();
  const members = useMembers(organization.data?.id);

  if (organization.isPending || projects.isPending || subscription.isPending) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full md:col-span-2" />
      </div>
    );
  }

  if (organization.isError || projects.isError || subscription.isError || !organization.data) {
    return (
      <div className="rounded-lg border border-line bg-surface p-6 text-sm text-red-500">
        Could not load settings summary.
      </div>
    );
  }

  const projectList = projects.data ?? [];
  const plan = subscription.data?.plan ?? organization.data.plan;
  const projectLimit = PLAN_PROJECT_LIMITS[plan];
  const projectLimitLabel = projectLimit === null ? 'Unlimited' : String(projectLimit);
  const status = subscription.data?.status ?? 'none';

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardBody>
            <p className="text-sm text-muted">Organization</p>
            <p className="mt-2 text-lg font-semibold text-primary">{organization.data.name}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-muted">Plan</p>
            <p className="mt-2 text-lg font-semibold capitalize text-primary">{plan}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-muted">Projects</p>
            <p className="mt-2 text-lg font-semibold text-primary">
              {projectList.length}/{projectLimitLabel}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-muted">Members</p>
            <p className="mt-2 text-lg font-semibold text-primary">
              {members.data?.length ?? (members.isPending ? '-' : 0)}
            </p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Organization details</h2>
        </CardHeader>
        <CardBody>
          <dl className="grid gap-4 text-sm md:grid-cols-2">
            <div>
              <dt className="text-muted">Slug</dt>
              <dd className="mt-1 font-medium text-primary">{organization.data.slug}</dd>
            </div>
            <div>
              <dt className="text-muted">Billing status</dt>
              <dd className="mt-1 font-medium capitalize text-primary">{status}</dd>
            </div>
            <div>
              <dt className="text-muted">Created</dt>
              <dd className="mt-1 font-medium text-primary">{formatDate(organization.data.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-muted">Updated</dt>
              <dd className="mt-1 font-medium text-primary">{formatDate(organization.data.updatedAt)}</dd>
            </div>
            <div>
              <dt className="text-muted">Current period end</dt>
              <dd className="mt-1 font-medium text-primary">
                {formatDate(subscription.data?.currentPeriodEnd)}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Stripe customer</dt>
              <dd className="mt-1 font-medium text-primary">
                {subscription.data?.hasStripeCustomer ? 'Connected' : 'Not connected'}
              </dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Project summary</h2>
        </CardHeader>
        <CardBody>
          {projectList.length === 0 ? (
            <p className="text-sm text-muted">
              No projects have been created yet. Log explorer, incidents, and alert rules unlock after the first project exists.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {projectList.map((project) => (
                <div key={project.id} className="rounded-lg border border-line bg-elevated p-4">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: project.color }}
                    />
                    <p className="font-medium text-primary">{project.name}</p>
                  </div>
                  <p className="mt-2 text-sm text-muted">{project.description ?? 'No description'}</p>
                  <p className="mt-3 text-xs text-muted">
                    {project.logSourceCount} log sources · {project.activeIncidentCount} active incidents
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
