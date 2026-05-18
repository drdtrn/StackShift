import type { Metadata } from 'next';
import { IncidentsView } from './_components/IncidentsView';

export const metadata: Metadata = { title: 'Incidents | StackSift' };

export default function IncidentsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Incidents</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Grouped alerts and root-cause analysis.
        </p>
      </div>
      <IncidentsView />
    </div>
  );
}
