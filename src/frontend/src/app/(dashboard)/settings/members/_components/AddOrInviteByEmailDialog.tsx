'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input, Modal } from '@/app/components/ui';
import type { UserRole } from '@/app/types';

const schema = z.object({
  email: z.string().email('Enter a valid email address.'),
  role: z.enum(['owner', 'admin', 'member', 'viewer']),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: { email: string; role: UserRole }) => Promise<unknown>;
  submitting: boolean;
}

export function AddOrInviteByEmailDialog({ open, onClose, onSubmit, submitting }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', role: 'member' },
  });

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  async function submit(values: FormValues): Promise<void> {
    await onSubmit({ email: values.email, role: values.role });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Add a team member">
      <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4" noValidate>
        <p className="text-sm text-muted">
          If the email is already on StackSift, they&apos;ll be added immediately. Otherwise
          we&apos;ll email them an invitation link that&apos;s good for 7 days.
        </p>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          errorMessage={errors.email?.message}
          {...register('email')}
        />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Role</span>
          <select
            className="rounded-md border border-line bg-elevated px-3 py-2 text-sm capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            {...register('role')}
          >
            <option value="owner">owner</option>
            <option value="admin">admin</option>
            <option value="member">member</option>
            <option value="viewer">viewer</option>
          </select>
        </label>
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={submitting}>
            Send
          </Button>
        </div>
      </form>
    </Modal>
  );
}
