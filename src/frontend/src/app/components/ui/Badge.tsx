import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/app/lib/utils';

/**
 * The six severity variants map directly to the design token palette defined
 * in globals.css (`--color-severity-*`). When FE-02 merges and adjusts the
 * token values, Badge automatically picks up the new colours with no code
 * changes required.
 *
 * Background uses a 15% opacity tint of the severity colour so the badge
 * does not compete with the text it annotates.
 */
const badgeVariants = cva(
  'inline-flex items-center rounded-full font-medium select-none',
  {
    variants: {
      variant: {
        critical:
          'bg-severity-critical/15 text-severity-critical',
        high:
          'bg-severity-high/15 text-severity-high',
        medium:
          'bg-severity-medium/15 text-severity-medium',
        low:
          'bg-severity-low/15 text-severity-low',
        info:
          'bg-severity-info/15 text-severity-info',
        neutral:
          'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'neutral',
      size: 'md',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

/**
 * Inline label for severity levels, statuses, and categorical tags.
 *
 * Used in: log table rows (severity column), incident cards, alert rule
 * status indicators, and anywhere a colour-coded label is needed.
 */
export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props} />
  );
}

export { badgeVariants };
