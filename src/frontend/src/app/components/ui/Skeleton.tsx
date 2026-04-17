'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/app/lib/utils';

export type SkeletonShape = 'line' | 'circle' | 'rectangle';

export interface SkeletonProps {
  /**
   * `line`      — full-width bar at fixed height (default 16px). Use for text placeholders.
   * `circle`    — square aspect ratio rounded to full circle. Use for avatars / icons.
   * `rectangle` — explicit width × height block. Use for images / chart placeholders.
   */
  shape?: SkeletonShape;
  /** Explicit width. Accepts any CSS length string (e.g. '120px', '50%'). */
  width?: string;
  /** Explicit height. Defaults: line → 16px, circle → 40px, rectangle → 80px. */
  height?: string;
  className?: string;
}

const shapeDefaults: Record<SkeletonShape, { height: string; classes: string }> = {
  line:      { height: '16px', classes: 'w-full rounded-md' },
  circle:    { height: '40px', classes: 'rounded-full' },
  rectangle: { height: '80px', classes: 'w-full rounded-md' },
};

/**
 * Animated placeholder shown while content is loading.
 *
 * Default: Framer Motion gradient sweep — an absolutely-positioned overlay
 * slides from left to right (x: -100% → 100%) over the zinc background,
 * producing a fluid shimmer effect.
 *
 * Reduced-motion fallback: opacity pulse (0.5 → 1 → 0.5) for users who
 * prefer reduced motion. The sweep is disabled entirely.
 *
 * The `aria-hidden` attribute prevents screen readers from announcing the
 * skeleton — they should be used alongside real content containers that carry
 * `aria-busy="true"` on the parent.
 */
export function Skeleton({
  shape = 'line',
  width,
  height,
  className,
}: SkeletonProps) {
  const reducedMotion = useReducedMotion();
  const defaults = shapeDefaults[shape];
  const resolvedHeight = height ?? defaults.height;
  const resolvedWidth = shape === 'circle' ? (width ?? resolvedHeight) : width;

  if (reducedMotion) {
    // Reduced-motion: simple opacity pulse, no sweep overlay.
    return (
      <motion.span
        aria-hidden="true"
        style={{
          display: 'inline-block',
          width: resolvedWidth,
          height: resolvedHeight,
        }}
        className={cn(
          'bg-zinc-200 dark:bg-zinc-800',
          defaults.classes,
          className,
        )}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    );
  }

  // Default: gradient sweep shimmer.
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        position: 'relative',
        overflow: 'hidden',
        width: resolvedWidth,
        height: resolvedHeight,
      }}
      className={cn(
        'bg-zinc-200 dark:bg-zinc-800',
        defaults.classes,
        className,
      )}
    >
      <motion.span
        style={{
          position: 'absolute',
          inset: 0,
        }}
        className="bg-gradient-to-r from-transparent via-white/30 dark:via-white/10 to-transparent"
        animate={{ x: ['-100%', '100%'] }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
    </span>
  );
}
