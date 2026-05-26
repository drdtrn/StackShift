import type { Metadata } from 'next';
import { RequireProject } from '@/app/components/providers/RequireProject';
import { AlertRulesView } from './_components/AlertRulesView';

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
      <div>
        <div>
          <h1 className="text-2xl font-semibold">Alert Rules</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Threshold and anomaly detection rules.
          </p>
        </div>
      </div>
      <RequireProject>
        <AlertRulesView />
      </RequireProject>
    </div>
  );
}
