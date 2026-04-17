'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';

// ---------------------------------------------------------------------------
// PageTransition
//
// Wraps route children with AnimatePresence so navigating between dashboard
// routes produces a smooth fade + slide-up entrance (~200ms).
//
// mode="wait" ensures the exiting page fully disappears before the entering
// page starts animating — prevents overlapping content during transitions.
//
// The motion.div uses flex-col + flex-1 so it inherits the available height
// from AppShell's <main> without introducing layout shift.
//
// Reduced-motion: opacity-only (no y translate) when
// prefers-reduced-motion: reduce is set in the OS.
// ---------------------------------------------------------------------------

interface PageTransitionProps {
  children: React.ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();

  const variants = reducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit:    { opacity: 0 },
      }
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        exit:    { opacity: 0, y: -8 },
      };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={variants.initial}
        animate={variants.animate}
        exit={variants.exit}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="flex flex-col flex-1"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
