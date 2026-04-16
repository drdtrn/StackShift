'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/app/lib/utils';

// ---------------------------------------------------------------------------
// PulsingBadge
//
// A notification badge that gently scales 1 → 1.15 → 1 on a 2-second loop
// when count > 0. The pulse draws the user's eye to unread notifications
// without being distracting.
//
// Hidden entirely when count === 0.
// Shows "99+" when count exceeds 99.
//
// Reduced-motion: animation is disabled; badge still renders statically.
// ---------------------------------------------------------------------------

interface PulsingBadgeProps {
  /** Number of unread notifications. Badge is hidden when 0. */
  count: number;
  className?: string;
}

export function PulsingBadge({ count, className }: PulsingBadgeProps) {
  const reducedMotion = useReducedMotion();

  if (count === 0) return null;

  return (
    <motion.span
      aria-hidden="true"
      className={cn(
        'flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-semibold text-white',
        className,
      )}
      animate={reducedMotion ? undefined : { scale: [1, 1.15, 1] }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      {count > 99 ? '99+' : count}
    </motion.span>
  );
}
