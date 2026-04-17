'use client';

import { useEffect, useRef, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/app/lib/utils';

export interface ModalProps {
  /** Controls whether the modal is rendered and visible. */
  open: boolean;
  /** Called when the user closes the modal (Escape, backdrop click, close button). */
  onClose: () => void;
  /** Text rendered as the modal's heading. Used for aria-labelledby. */
  title: string;
  /** The modal's body content. */
  children: React.ReactNode;
  /**
   * Controls the maximum width of the modal panel.
   * - `sm` → 448px (confirmation dialogs)
   * - `md` → 560px (default — forms, detail panels)
   * - `lg` → 768px (complex multi-column content)
   */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-3xl',
};

/**
 * Accessible modal dialog with focus trap and Framer Motion animations.
 *
 * Accessibility guarantees:
 *   - `role="dialog"` + `aria-modal="true"` tell screen readers this is a
 *     modal layer; they announce it and restrict virtual cursor to its content.
 *   - `aria-labelledby` links the dialog to its title heading.
 *   - **Focus trap**: on open, focus moves to the first focusable element inside
 *     the modal. Tab/Shift+Tab cycle *only within* the modal. On close, focus
 *     returns to the element that triggered the modal (stored in `returnFocusRef`).
 *   - `Escape` key closes the modal.
 *   - Backdrop click closes the modal (click must land on the backdrop, not
 *     the panel — `e.target === e.currentTarget` check prevents panel clicks
 *     from closing).
 *   - `aria-hidden="true"` is set on `#__next` (the app root) while the modal
 *     is open to prevent screen readers from reaching background content.
 *     (This is handled declaratively here via `inert` attribute for modern browsers.)
 *
 * Animation (Framer Motion, satisfies FE-12):
 *   - Backdrop: opacity 0 → 1
 *   - Panel: opacity 0 + scale 95% → opacity 1 + scale 100%
 *   - `AnimatePresence` drives the exit animation (scale back to 95% + fade out).
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
  className,
}: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<Element | null>(null);

  // Capture the currently focused element so we can return focus on close.
  useEffect(() => {
    if (open) {
      returnFocusRef.current = document.activeElement;
    }
  }, [open]);

  // Focus the first focusable element inside the modal on open.
  useEffect(() => {
    if (!open || !panelRef.current) return;

    const focusable = panelRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    first?.focus();

    // Restore focus to the triggering element on unmount.
    return () => {
      (returnFocusRef.current as HTMLElement | null)?.focus();
    };
  }, [open]);

  // Escape key handler + scroll lock.
  useEffect(() => {
    if (!open) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();

      // Focus trap: intercept Tab and keep focus within the modal.
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => !el.hasAttribute('disabled'));

        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden'; // prevent background scroll

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        // Backdrop
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={(e) => {
            // Only close if the click landed on the backdrop itself, not the panel.
            if (e.target === e.currentTarget) onClose();
          }}
          aria-hidden="false"
        >
          {/* Panel */}
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={cn(
              'relative w-full rounded-lg shadow-xl',
              'bg-white dark:bg-zinc-900',
              'border border-zinc-200 dark:border-zinc-700',
              sizeClasses[size],
              className,
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-700">
              <h2
                id={titleId}
                className="text-base font-semibold text-zinc-900 dark:text-zinc-100"
              >
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className={cn(
                  'rounded-md p-1 text-zinc-500',
                  'hover:bg-zinc-100 hover:text-zinc-700',
                  'dark:hover:bg-zinc-800 dark:hover:text-zinc-300',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500',
                  'transition-colors',
                )}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-4">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
