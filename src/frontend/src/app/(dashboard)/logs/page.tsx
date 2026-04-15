import type { Metadata } from 'next';
import { LiveLogStream } from './_components/LiveLogStream';

export const metadata: Metadata = { title: 'Log Explorer | StackSift' };

/**
 * Log Explorer page — maps to URL: /logs
 *
 * US-09: LiveLogStream provides a real-time feed via SignalR (mock mode
 * in development). Full-text search, filters, and DataTable come in US-03.
 */
export default function LogsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Log Explorer</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Live log stream from all connected projects.
        </p>
      </div>
      <LiveLogStream />
    </div>
  );
}
