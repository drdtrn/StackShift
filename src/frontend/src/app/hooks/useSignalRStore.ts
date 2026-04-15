import { create } from 'zustand';
import { HubConnectionState } from '@microsoft/signalr';

// ---------------------------------------------------------------------------
// useSignalRStore
//
// Minimal Zustand store that holds the current SignalR connection state.
//
// Written by: useSignalR (on every state transition)
// Read by:    ConnectionStatusIndicator (in TopBar)
//
// Using Zustand rather than prop drilling means TopBar never needs to know
// about the hub — it just reads a value from the store.
// ---------------------------------------------------------------------------

interface SignalRStore {
  connectionState: HubConnectionState;
  setConnectionState: (state: HubConnectionState) => void;
}

export const useSignalRStore = create<SignalRStore>()((set) => ({
  connectionState: HubConnectionState.Disconnected,
  setConnectionState: (connectionState) => set({ connectionState }),
}));
