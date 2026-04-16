'use client';

import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/app/lib/utils';

// ---------------------------------------------------------------------------
// AnimatedCard
//
// A Framer Motion alternative to <Card hoverable> for cards that should lift
// on hover using spring-based animation rather than CSS transitions.
//
// Use this in place of <Card> when you want the hover-lift to be driven by
// Framer Motion (e.g. incident list items, project cards).
// Use plain <Card> for static dashboard metric panels.
//
// Does NOT wrap <Card> to avoid a redundant div nesting — carries the same
// base styles (border, background, rounded corners, overflow-hidden).
//
// Reduced-motion: whileHover is disabled; card renders without hover lift.
// ---------------------------------------------------------------------------

// Use HTMLMotionProps to avoid conflicts between React's DragEventHandler and
// Framer Motion's onDrag signature. We omit the animation props we control
// internally so consumers cannot accidentally override them.
export type AnimatedCardProps = Omit<
  HTMLMotionProps<'div'>,
  'animate' | 'initial' | 'exit' | 'transition' | 'whileHover' | 'variants'
> & {
  children: React.ReactNode;
};

export function AnimatedCard({ className, children, ...props }: AnimatedCardProps) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      className={cn(
        'rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900',
        'overflow-hidden cursor-pointer',
        className,
      )}
      whileHover={
        reducedMotion
          ? undefined
          : { y: -2, boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }
      }
      transition={{ duration: 0.15 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
