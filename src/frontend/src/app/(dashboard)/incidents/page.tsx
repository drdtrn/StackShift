import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Incidents | StackSift' };

/**
 * Incident list page — maps to URL: /incidents
 *
 * Final implementation (US-04): sortable list of incidents with status
 * (open/resolved), severity badge, linked project, and timestamp.
 * Click → /incidents/[id] for AI explanation.
 */
export default function IncidentsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Incidents</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Grouped alerts and root-cause analysis.
        </p>
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500 text-sm">
        Incident list coming in US-04 — status, severity, AI analysis.
      </div>
    </div>
  );
}
