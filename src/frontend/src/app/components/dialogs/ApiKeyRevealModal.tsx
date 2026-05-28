'use client';

import { useState } from 'react';
import { Button } from '@/app/components/ui/Button';
import { CopyableCode } from '@/app/components/ui/CopyableCode';
import { Modal } from '@/app/components/ui/Modal';

interface ApiKeyRevealModalProps {
  open: boolean;
  apiKey: string;
  keyPrefix: string;
  onConfirmed: () => void;
}

export function ApiKeyRevealModal({
  open,
  apiKey,
  keyPrefix,
  onConfirmed,
}: ApiKeyRevealModalProps) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <Modal
      open={open}
      onClose={() => undefined}
      title="Save this API key"
      dismissible={false}
      size="lg"
    >
      <div className="flex flex-col gap-4">
        <div className="space-y-1">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Key prefix: <code className="font-mono">{keyPrefix}</code>
          </p>
        </div>

        <CopyableCode value={apiKey} />

        <label className="flex items-start gap-3 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
          />
          <span>I have saved this key somewhere safe. I understand it will not be shown again.</span>
        </label>

        <div className="flex justify-end">
          <Button type="button" disabled={!confirmed} onClick={onConfirmed}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}
