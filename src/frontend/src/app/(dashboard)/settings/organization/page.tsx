'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Button, Card, CardBody, CardHeader, Input, Skeleton } from '@/app/components/ui';
import { useAuthStore } from '@/app/hooks/useAuthStore';
import { useCurrentOrganization } from '@/app/hooks/queries';
import { useUpdateOrganization } from '@/app/hooks/mutations';

export default function OrganizationSettingsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const canManage = role === 'owner';
  const organization = useCurrentOrganization();
  const updateOrganization = useUpdateOrganization();
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    if (!organization.data) return;
    setName(organization.data.name);
    setLogoUrl(organization.data.logoUrl ?? '');
  }, [organization.data]);

  if (organization.isPending) {
    return (
      <Card>
        <CardBody className="flex flex-col gap-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardBody>
      </Card>
    );
  }

  if (organization.isError || !organization.data) {
    return (
      <div className="rounded-lg border border-line bg-surface p-6 text-sm text-red-500">
        Could not load organization details.
      </div>
    );
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage || !name.trim()) return;
    updateOrganization.mutate({
      id: organization.data.id,
      name: name.trim(),
      logoUrl: logoUrl.trim() ? logoUrl.trim() : null,
    });
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">Organization profile</h2>
        <p className="mt-1 text-sm text-muted">
          {canManage
            ? 'Update the organization name and logo used across StackSift.'
            : 'Organization profile details are managed by owners.'}
        </p>
      </CardHeader>
      <CardBody>
        <form className="flex max-w-2xl flex-col gap-4" onSubmit={handleSubmit}>
          <Input
            label="Organization name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={!canManage || updateOrganization.isPending}
            required
            minLength={2}
          />
          <Input
            label="Logo URL"
            type="url"
            value={logoUrl}
            onChange={(event) => setLogoUrl(event.target.value)}
            disabled={!canManage || updateOrganization.isPending}
            placeholder="https://example.com/logo.png"
          />
          <dl className="grid gap-3 rounded-lg border border-line bg-elevated p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">Slug</dt>
              <dd className="font-medium text-primary">{organization.data.slug}</dd>
            </div>
            <div>
              <dt className="text-muted">Plan</dt>
              <dd className="font-medium capitalize text-primary">{organization.data.plan}</dd>
            </div>
            <div>
              <dt className="text-muted">Created</dt>
              <dd className="font-medium text-primary">
                {new Date(organization.data.createdAt).toLocaleDateString()}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Updated</dt>
              <dd className="font-medium text-primary">
                {new Date(organization.data.updatedAt).toLocaleDateString()}
              </dd>
            </div>
          </dl>
          {canManage ? (
            <div>
              <Button
                type="submit"
                variant="primary"
                loading={updateOrganization.isPending}
                disabled={!name.trim()}
              >
                Save changes
              </Button>
            </div>
          ) : null}
        </form>
      </CardBody>
    </Card>
  );
}
