import { cn } from '@/app/lib/utils';

export type SpinnerSize = 'sm' | 'md' | 'lg';

const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-[3px]',
};

export interface SpinnerProps {
  /** Controls the diameter and border width of the spinner ring. */
  size?: SpinnerSize;
  className?: string;
}

/**
 * Animated loading indicator.
 *
 * Renders a CSS `animate-spin` ring. Colour inherits from `currentColor`
 * so it automatically adapts to the text colour of its container — works in
 * both light and dark mode without extra classes.
 *
 * The transparent right border creates the "gap" in the ring visual.
 */
export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        'inline-block rounded-full border-current border-r-transparent animate-spin',
        sizeClasses[size],
        className,
      )}
    />
  );
}
