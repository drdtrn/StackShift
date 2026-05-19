import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface NotificationStore {
  unread: number;
  increment: () => void;
  reset: () => void;
}

export const useNotificationStore = create<NotificationStore>()(
  devtools(
    (set) => ({
      unread: 0,
      increment: () => set((s) => ({ unread: s.unread + 1 }), false, 'increment'),
      reset: () => set({ unread: 0 }, false, 'reset'),
    }),
    { name: 'NotificationStore' },
  ),
);
