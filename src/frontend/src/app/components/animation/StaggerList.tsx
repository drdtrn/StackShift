'use client';

import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/app/lib/utils';

// ---------------------------------------------------------------------------
// StaggerList / StaggerItem
//
// Staggered entrance animation for list pages (Logs, Incidents, Alerts,
// Projects). Items fade in sequentially on first render with a 30ms delay
// between each, keeping the total entrance under 500ms for up to ~16 items.
//
// Usage:
//   <StaggerList>
//     {items.map(item => (
//       <StaggerItem key={item.id}>
//         <MyCard item={item} />
//       </StaggerItem>
//     ))}
//   </StaggerList>
//
// IMPORTANT: Do NOT use StaggerItem to wrap individual virtualised rows in
// DataTable — virtualised DOM nodes are recycled and the stagger timing would
// break. Wrap the entire page-level section with StaggerList instead, or use
// it for card-grid layouts where all items are in the DOM simultaneously.
//
// Reduced-motion: initial state is set to "visible" so items appear
// immediately without an entrance animation.
// ---------------------------------------------------------------------------

const listVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.03, // 30ms between each child
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: 'easeOut' },
  },
};

// No-op variants for reduced-motion — items start in the visible state.
const listVariantsReduced = {};
const itemVariantsReduced = {
  hidden: { opacity: 1, y: 0 },
  visible: { opacity: 1, y: 0 },
};

/* ─── Container ─────────────────────────────────────────────────────────── */

export type StaggerListProps = Omit<
  HTMLMotionProps<'div'>,
  'animate' | 'initial' | 'exit' | 'transition' | 'variants'
> & {
  children: React.ReactNode;
};

export function StaggerList({ className, children, ...props }: StaggerListProps) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      variants={reducedMotion ? listVariantsReduced : listVariants}
      initial="hidden"
      animate="visible"
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/* ─── Item ───────────────────────────────────────────────────────────────── */

export type StaggerItemProps = Omit<
  HTMLMotionProps<'div'>,
  'animate' | 'initial' | 'exit' | 'transition' | 'variants'
> & {
  children: React.ReactNode;
};

export function StaggerItem({ className, children, ...props }: StaggerItemProps) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      variants={reducedMotion ? itemVariantsReduced : itemVariants}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}
