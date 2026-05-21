'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Sparkles, X } from 'lucide-react';
import { useSubscription } from '@/app/hooks/queries/use-subscription';
import { cn } from '@/app/lib/utils';

const DISMISS_KEY = 'stacksift-upgrade-banner-dismissed';

const subscribeNoop = () => () => {};

function readPersistedDismissal(): boolean {
  if (typeof window === 'undefined') return false;
  return window.sessionStorage.getItem(DISMISS_KEY) === 'true';
}

export function UpgradeBanner() {
  const sub = useSubscription();
  const persistedDismissed = useSyncExternalStore(
    subscribeNoop,
    readPersistedDismissal,
    () => false,
  );
  const [justDismissed, setJustDismissed] = useState(false);

  const handleDismiss = () => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(DISMISS_KEY, 'true');
    }
    setJustDismissed(true);
  };

  if (persistedDismissed || justDismissed) return null;
  if (sub.isPending || sub.isError || !sub.data) return null;
  if (sub.data.plan !== 'free') return null;

  return (
    <div
      role="region"
      aria-label="Upgrade your plan"
      className={cn(
        'relative flex items-start gap-3 rounded-lg border px-4 py-3',
        'border-blue-500/50 bg-blue-500/10 text-blue-800 dark:text-blue-200',
      )}
    >
      <Sparkles className="h-5 w-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 text-sm">
        <p className="font-medium">You&rsquo;re on the Free plan.</p>
        <p className="text-blue-700/80 dark:text-blue-300/80">
          Upgrade to Indie or Team for more projects, longer retention, and more AI analyses per month.
        </p>
      </div>
      <Link
        href="/settings/billing"
        className="self-center text-sm font-medium underline hover:no-underline"
      >
        View plans
      </Link>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss upgrade banner"
        className="flex-shrink-0 rounded p-0.5 text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
