'use client';

import { useState } from 'react';
import { Button } from '@/app/components/ui/Button';
import { Input } from '@/app/components/ui/Input';
import { Modal } from '@/app/components/ui/Modal';

interface ConfirmDeleteByNameDialogProps {
  open: boolean;
  name: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmDeleteByNameDialog({
  open,
  name,
  loading = false,
  onClose,
  onConfirm,
}: ConfirmDeleteByNameDialogProps) {
  const [value, setValue] = useState('');

  return (
    <Modal open={open} onClose={onClose} title="Delete log source" size="sm">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Type <span className="font-medium text-zinc-900 dark:text-zinc-100">{name}</span> to confirm.
        </p>
        <Input value={value} onChange={(event) => setValue(event.target.value)} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            loading={loading}
            disabled={value !== name}
            onClick={onConfirm}
          >
            Delete
          </Button>
        </div>
      </div>
    </Modal>
  );
}
