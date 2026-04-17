import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { Spinner } from '@/app/components/ui/Spinner';

export const metadata: Metadata = { title: 'Log Explorer | StackSift' };

// LiveLogStream depends on @microsoft/signalr (~200 KB) which should not be
// part of the initial page bundle. Code-split and disable SSR — SignalR
// requires a browser WebSocket environment.
const LiveLogStream = dynamic(
  () => import('./_components/LiveLogStream').then((m) => m.LiveLogStream),
  { loading: () => <Spinner size="lg" />, ssr: false },
);

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
