import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Alert Rules | StackSift' };

/**
 * Alert rules list page — maps to URL: /alerts
 *
 * Final implementation (US-06): list of alert rules with metric, threshold,
 * window, status (active/paused), and last-fired time.
 * Links to /alerts/new to create a rule.
 */
export default function AlertsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Alert Rules</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Threshold and anomaly detection rules.
          </p>
        </div>
        <Link
          href="/alerts/new"
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          New rule
        </Link>
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500 text-sm">
        Alert rule list coming in US-06.
      </div>
    </div>
  );
}
