'use client';

import { Button } from '@/app/components/ui/Button';
import { Modal } from '@/app/components/ui/Modal';

interface RegenerateKeyDialogProps {
  open: boolean;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function RegenerateKeyDialog({
  open,
  loading = false,
  onClose,
  onConfirm,
}: RegenerateKeyDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title="Regenerate API key" size="sm">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          This will immediately invalidate the current key. Any service still using it will start receiving 401 errors.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" loading={loading} onClick={onConfirm}>
            Regenerate
          </Button>
        </div>
      </div>
    </Modal>
  );
}
