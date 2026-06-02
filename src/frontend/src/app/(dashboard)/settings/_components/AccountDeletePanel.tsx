'use client';

import { useState } from 'react';
import { Button, Card, CardBody, Input } from '@/app/components/ui';
import { useRequestAccountDeletion } from '@/app/hooks/mutations/use-request-account-deletion';
import { useSignOut } from '@/app/hooks/useSignOut';
import { ACCOUNT_DELETE_CONFIRMATION } from '@/app/lib/account-schemas';

export function AccountDeletePanel() {
  const [confirmation, setConfirmation] = useState('');
  const deletion = useRequestAccountDeletion();
  const { signOut, isLoading: signingOut } = useSignOut();

  if (deletion.isSuccess) {
    return (
      <Card>
        <CardBody className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Account scheduled for deletion</h2>
          <p className="text-sm text-muted">
            Your account is disabled now and will be permanently erased after{' '}
            {new Date(deletion.data.gracePeriodEndsAt).toLocaleDateString()}. Save the
            token below — it&apos;s the only way to restore your account during the grace
            period.
          </p>
          <code className="block break-all rounded-lg border border-line bg-elevated p-3 text-xs">
            {deletion.data.cancellationToken}
          </code>
          <Button type="button" variant="primary" loading={signingOut} onClick={signOut}>
            I&apos;ve saved my token — sign out
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Delete account</h2>
        <p className="text-sm text-muted">
          This requests permanent erasure of your account under GDPR Article 17. You have
          a 30-day grace period to restore it; after that your data is deleted (audit and
          billing records are anonymised, not removed, where the law requires it).
        </p>
        <Input
          label={`Type "${ACCOUNT_DELETE_CONFIRMATION}" to confirm`}
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          errorMessage={
            deletion.isError
              ? 'Could not delete your account. Check the confirmation and try again.'
              : undefined
          }
        />
        <Button
          type="button"
          variant="destructive"
          disabled={confirmation !== ACCOUNT_DELETE_CONFIRMATION}
          loading={deletion.isPending}
          onClick={() => deletion.mutate(confirmation)}
        >
          Delete my account
        </Button>
      </CardBody>
    </Card>
  );
}
