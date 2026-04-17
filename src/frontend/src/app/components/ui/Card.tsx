import { cn } from '@/app/lib/utils';

/* ─── Slot components ──────────────────────────────────────────────────────── */

export type CardHeaderProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Optional header slot. Renders with a bottom border to separate it from
 * the card body. Typically contains a title + optional action row.
 */
export function CardHeader({ className, ...props }: CardHeaderProps) {
  return (
    <div
      className={cn(
        'px-6 py-4 border-b border-zinc-200 dark:border-zinc-800',
        className,
      )}
      {...props}
    />
  );
}

export type CardBodyProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Main content slot. Has consistent padding that matches header/footer.
 */
export function CardBody({ className, ...props }: CardBodyProps) {
  return (
    <div className={cn('px-6 py-4', className)} {...props} />
  );
}

export type CardFooterProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Optional footer slot. Renders with a top border to visually separate it
 * from the body. Typically contains action buttons or metadata.
 */
export function CardFooter({ className, ...props }: CardFooterProps) {
  return (
    <div
      className={cn(
        'px-6 py-4 border-t border-zinc-200 dark:border-zinc-800',
        className,
      )}
      {...props}
    />
  );
}

/* ─── Root Card ─────────────────────────────────────────────────────────────── */

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * When true, applies a subtle shadow lift on hover and a slight scale
   * transform. Use for clickable cards (incident list items, project cards).
   * Omit for static cards (dashboard metric panels).
   */
  hoverable?: boolean;
}

/**
 * General-purpose content container.
 *
 * Compose with the named slot components:
 * ```tsx
 * <Card hoverable>
 *   <CardHeader>
 *     <h2>Incident #1042</h2>
 *   </CardHeader>
 *   <CardBody>
 *     <p>Something went wrong in production.</p>
 *   </CardBody>
 *   <CardFooter>
 *     <Button size="sm">View details</Button>
 *   </CardFooter>
 * </Card>
 * ```
 *
 * Or without slots for simpler cases:
 * ```tsx
 * <Card className="p-6">
 *   <MetricWidget />
 * </Card>
 * ```
 */
export function Card({ className, hoverable = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900',
        'overflow-hidden',
        hoverable && [
          'cursor-pointer transition-all duration-150',
          'hover:shadow-md hover:-translate-y-0.5',
          'active:translate-y-0 active:shadow-sm',
        ],
        className,
      )}
      {...props}
    />
  );
}
