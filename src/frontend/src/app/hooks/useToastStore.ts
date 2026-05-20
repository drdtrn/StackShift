import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/* ─── Types ─────────────────────────────────────────────────────────────────── */

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  href: string;
}

export interface Toast {
  /** Auto-generated unique ID used as React key and for removal. */
  id: string;
  /** Controls colour and icon. */
  variant: ToastVariant;
  /** Short message displayed in the toast. */
  message: string;
  /**
   * Duration in milliseconds before the toast auto-dismisses.
   * Pass `null` to disable auto-dismiss (user must click close).
   * Default: 5000ms.
   */
  duration?: number | null;
  /**
   * When true, adds a red pulse ring animation to the toast container.
   * Used for critical alert notifications to draw immediate attention.
   */
  pulse?: boolean;
  /** Optional CTA rendered as a button inside the toast. */
  action?: ToastAction;
}

export interface ToastInput {
  variant: ToastVariant;
  message: string;
  duration?: number | null;
  /**
   * When true, adds a red pulse ring animation to the toast container.
   * Used for critical alert notifications to draw immediate attention.
   */
  pulse?: boolean;
  action?: ToastAction;
}

interface ToastStore {
  toasts: Toast[];
  /**
   * Adds a toast to the stack and returns its auto-generated ID.
   * The caller can store the ID to remove the toast programmatically
   * (e.g. dismiss on API success before the 5s timeout).
   */
  addToast: (input: ToastInput) => string;
  /** Removes a specific toast by ID. Called by the close button and auto-dismiss. */
  removeToast: (id: string) => void;
  /** Clears all toasts — useful on route change or session end. */
  clearAll: () => void;
}

/* ─── ID generator ──────────────────────────────────────────────────────────── */

let _counter = 0;
const generateId = () => `toast-${Date.now()}-${++_counter}`;

/* ─── Store ─────────────────────────────────────────────────────────────────── */

/**
 * Zustand store that manages the global toast notification stack.
 *
 * Why Zustand instead of React Context?
 *   - Toasts need to be triggered from *anywhere* — inside API error handlers,
 *     async callbacks, even non-component utility functions. Context requires
 *     a hook call, which means you need to be inside a component.
 *   - Zustand's `useToastStore.getState().addToast(...)` can be called from
 *     any module with zero boilerplate.
 *
 * devtools middleware:
 *   - Wraps the store so Redux DevTools (browser extension) can inspect state.
 *   - No-ops in production builds — the middleware is tree-shaken when
 *     NODE_ENV is not 'development'.
 *
 * Usage:
 *   // Inside a component:
 *   const { addToast } = useToastStore();
 *   addToast({ variant: 'success', message: 'Saved!' });
 *
 *   // Outside a component (e.g. Axios interceptor):
 *   import { useToastStore } from '@/app/hooks/useToastStore';
 *   useToastStore.getState().addToast({ variant: 'error', message: 'Request failed' });
 */
export const useToastStore = create<ToastStore>()(
  devtools(
    (set) => ({
      toasts: [],

      addToast: (input) => {
        const id = generateId();
        set(
          (state) => ({
            toasts: [
              ...state.toasts,
              {
                id,
                variant: input.variant,
                message: input.message,
                duration: input.duration ?? 5000,
                pulse: input.pulse ?? false,
                action: input.action,
              },
            ],
          }),
          false,
          'addToast',
        );
        return id;
      },

      removeToast: (id) => {
        set(
          (state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }),
          false,
          'removeToast',
        );
      },

      clearAll: () => {
        set({ toasts: [] }, false, 'clearAll');
      },
    }),
    { name: 'ToastStore' },
  ),
);
