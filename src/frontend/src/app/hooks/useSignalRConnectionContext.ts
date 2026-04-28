'use client';

import { createContext, useContext } from 'react';
import type { IHubConnection } from '@/app/lib/signalr-mock';

// Holds the single shared hub connection created by SignalRProvider.
// Null when no provider is mounted (e.g., in isolated unit tests).
export const SignalRConnectionContext = createContext<IHubConnection | null>(null);

export function useSignalRConnectionFromContext(): IHubConnection | null {
  return useContext(SignalRConnectionContext);
}
