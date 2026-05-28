'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/app/lib/utils';

interface CopyableCodeProps {
  value: string;
  language?: string;
  className?: string;
}

export function CopyableCode({ value, language, className }: CopyableCodeProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        'flex min-w-0 items-start gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3',
        'dark:border-zinc-800 dark:bg-zinc-950',
        className,
      )}
    >
      <pre className="min-w-0 flex-1 overflow-x-auto text-xs leading-5 text-zinc-800 dark:text-zinc-100">
        <code data-language={language}>{value}</code>
      </pre>
      <Button type="button" variant="secondary" size="sm" onClick={copy}>
        {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}
