'use client';

import dynamic from 'next/dynamic';
import { Spinner } from '@/app/components/ui/Spinner';

// SignalR requires a browser WebSocket environment — ssr: false must live in a
// Client Component because Next.js 16 disallows it in Server Components.
const LiveLogStream = dynamic(
  () => import('./LiveLogStream').then((m) => m.LiveLogStream),
  { loading: () => <Spinner size="lg" />, ssr: false },
);

export function LiveLogStreamLoader() {
  return <LiveLogStream />;
}
