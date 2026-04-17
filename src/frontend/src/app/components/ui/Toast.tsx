'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { useToastStore, type Toast as ToastType, type ToastVariant } from '@/app/hooks/useToastStore';

/* ─── Variant config ─────────────────────────────────────────────────────────── */

/**
 * Each variant gets:
 *   - A background and border colour
 *   - An icon (from Lucide) with its own colour
 *   - A progress bar colour
 *
 * Colours deliberately do not use severity tokens — toasts are system feedback
 * (action outcomes), not log-level severity indicators. They use standard
 * semantic colours: green = success, red = error, amber = warning, blue = info.
 */
const variantConfig: Record<
  ToastVariant,
  { icon: React.ReactNode; barClass: string; containerClass: string }
> = {
  success: {
    icon: <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" aria-hidden="true" />,
    barClass: 'bg-green-500',
    containerClass: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950',
  },
  error: {
    icon: <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" aria-hidden="true" />,
    barClass: 'bg-red-500',
    containerClass: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950',
  },
  warning: {
    icon: <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" aria-hidden="true" />,
    barClass: 'bg-amber-500',
    containerClass: 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950',
  },
  info: {
    icon: <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" aria-hidden="true" />,
    barClass: 'bg-blue-500',
    containerClass: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950',
  },
};

/* ─── Single Toast item ──────────────────────────────────────────────────────── */

interface ToastItemProps {
  toast: ToastType;
}

/**
 * Individual toast notification card.
 *
 * Auto-dismiss:
 *   When `duration` is a number > 0, a `setTimeout` is set on mount.
 *   The timeout is cleaned up on unmount so if the user manually closes the
 *   toast before the timer fires, the `removeToast` call is not duplicated.
 *
 * Progress bar:
 *   A CSS `transition` shrinks a bar from 100% to 0% over `duration` ms.
 *   The transition is driven by a one-frame requestAnimationFrame trick:
 *   the bar starts at 100% width and immediately switches to 0% after mount,
 *   letting CSS transition handle the animation. This is cheaper than a
 *   JS interval updating state every 16ms.
 *
 * Accessibility:
 *   - `role="alert"` causes screen readers to announce the message immediately
 *     when the toast appears, without the user needing to navigate to it.
 *   - `aria-live="assertive"` reinforces immediate announcement for errors.
 *   - `aria-live="polite"` for non-error variants (success/warning/info) so
 *     the announcement does not interrupt ongoing screen reader activity.
 */
function ToastItem({ toast }: ToastItemProps) {
  const removeToast = useToastStore((s) => s.removeToast);
  const config = variantConfig[toast.variant];
  const barRef = useRef<HTMLDivElement>(null);
  const hasDuration = typeof toast.duration === 'number' && toast.duration > 0;

  // Auto-dismiss timer.
  useEffect(() => {
    if (!hasDuration) return;
    const timer = setTimeout(() => removeToast(toast.id), toast.duration as number);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, hasDuration, removeToast]);

  // Kick off the progress bar shrink animation after mount.
  useEffect(() => {
    if (!barRef.current || !hasDuration) return;
    // requestAnimationFrame ensures the browser has painted the initial 100% state.
    const raf = requestAnimationFrame(() => {
      if (barRef.current) {
        barRef.current.style.width = '0%';
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [hasDuration]);

  return (
    <div
      role="alert"
      aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
      className={cn(
        'relative flex items-start gap-3 rounded-lg border px-4 py-3 shadow-md',
        'min-w-[280px] max-w-sm overflow-hidden',
        config.containerClass,
        toast.pulse && 'ring-2 ring-red-500 animate-pulse',
      )}
    >
      {config.icon}

      <p className="flex-1 text-sm text-zinc-800 dark:text-zinc-200 pr-2">
        {toast.message}
      </p>

      <button
        type="button"
        onClick={() => removeToast(toast.id)}
        aria-label="Dismiss notification"
        className={cn(
          'flex-shrink-0 rounded p-0.5 text-zinc-500',
          'hover:text-zinc-700 dark:hover:text-zinc-300',
          'focus:outline-none focus:ring-1 focus:ring-blue-500',
          'transition-colors',
        )}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>

      {/* Progress bar — only rendered when auto-dismiss is active */}
      {hasDuration && (
        <div
          ref={barRef}
          style={{
            transitionDuration: `${toast.duration}ms`,
            transitionTimingFunction: 'linear',
            transitionProperty: 'width',
            width: '100%',
          }}
          className={cn(
            'absolute bottom-0 left-0 h-0.5',
            config.barClass,
          )}
        />
      )}
    </div>
  );
}

/* ─── Toast container ────────────────────────────────────────────────────────── */

/**
 * Renders the full stack of active toasts.
 *
 * Placement: fixed to the bottom-right corner of the viewport, stacked vertically
 * with newest at the bottom. The z-index (z-[100]) sits above modals (z-50) so
 * a toast triggered from within a modal is still visible.
 *
 * AnimatePresence: each toast slides in from the right and fades out on removal.
 * `layout` prop on the motion wrapper causes the stack to animate smoothly when
 * a toast in the middle is removed.
 *
 * Where to mount:
 *   Place `<ToastContainer />` once in `src/app/layout.tsx` (the root layout).
 *   It reads from the Zustand store directly — no props needed.
 */
export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, x: 64 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 64 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="pointer-events-auto"
          >
            <ToastItem toast={toast} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
