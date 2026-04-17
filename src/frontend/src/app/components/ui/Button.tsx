'use client';

import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Spinner } from './Spinner';
import { cn } from '@/app/lib/utils';

/**
 * CVA variant map.
 *
 * `variant` — controls visual weight and intent:
 *   - `primary`     → solid blue, main call-to-action
 *   - `secondary`   → muted zinc, secondary actions
 *   - `ghost`       → transparent until hover, used in toolbars / icon rows
 *   - `destructive` → solid red, delete / irreversible actions
 *
 * `size` — controls height and horizontal padding:
 *   - `sm` h-8  → inline context (table rows, badges rows)
 *   - `md` h-10 → default form button
 *   - `lg` h-12 → hero / onboarding CTA
 */
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium',
    'transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
  ].join(' '),
  {
    variants: {
      variant: {
        primary: [
          'bg-blue-600 text-white',
          'hover:bg-blue-700',
          'focus-visible:ring-blue-600',
          'dark:bg-blue-500 dark:hover:bg-blue-600',
        ].join(' '),
        secondary: [
          'bg-zinc-100 text-zinc-900',
          'hover:bg-zinc-200',
          'focus-visible:ring-zinc-500',
          'dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700',
        ].join(' '),
        ghost: [
          'text-zinc-700',
          'hover:bg-zinc-100',
          'focus-visible:ring-zinc-500',
          'dark:text-zinc-300 dark:hover:bg-zinc-800',
        ].join(' '),
        destructive: [
          'bg-red-600 text-white',
          'hover:bg-red-700',
          'focus-visible:ring-red-600',
          'dark:bg-red-700 dark:hover:bg-red-800',
        ].join(' '),
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * When true, the button is disabled and a Spinner renders to its left.
   * Prevents double-submit on async form actions.
   */
  loading?: boolean;
}

/**
 * Primary interactive element for all user actions.
 *
 * Uses `forwardRef` so it can be composed inside libraries that need a ref
 * (e.g. Radix UI, Floating UI, focus managers).
 *
 * The `loading` prop simultaneously:
 *   1. Sets `disabled` on the underlying <button> → blocks further clicks
 *   2. Sets `aria-busy="true"` → screen readers announce the pending state
 *   3. Renders a `<Spinner size="sm" />` → visual feedback
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, loading = false, disabled, children, ...props },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Spinner size="sm" />}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';

export { Button, buttonVariants };
