'use client';

import { forwardRef, useId } from 'react';
import { cn } from '@/app/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Rendered in a <label> above the input field. */
  label?: string;
  /** Rendered below the field in muted text. Hidden when `errorMessage` is set. */
  helperText?: string;
  /** Rendered below the field in red with role="alert". Overrides helperText. */
  errorMessage?: string;
  /** ReactNode rendered inside the left edge of the input (e.g. a Lucide icon). */
  leftIcon?: React.ReactNode;
  /** ReactNode rendered inside the right edge of the input (e.g. a clear button). */
  rightIcon?: React.ReactNode;
}

/**
 * Controlled/uncontrolled text input with full composition support.
 *
 * Accessibility guarantees:
 *   - `<label>` is always linked to the input via matching `htmlFor`/`id`.
 *   - `aria-describedby` points at the helper OR error element so screen
 *     readers announce context text when the field is focused.
 *   - `aria-invalid="true"` is set when `errorMessage` is provided — this
 *     signals the error state to assistive technology without relying on colour.
 *   - Error paragraph carries `role="alert"` so it is announced immediately
 *     when it appears (e.g. after form submission).
 *
 * `forwardRef` allows React Hook Form's `register()` to attach its ref.
 */
const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { className, label, helperText, errorMessage, leftIcon, rightIcon, id, ...props },
    ref,
  ) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const hasError = Boolean(errorMessage);
    const describedBy = [
      !hasError && helperText ? `${inputId}-helper` : null,
      hasError ? `${inputId}-error` : null,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <span className="pointer-events-none absolute left-3 flex items-center text-zinc-400 dark:text-zinc-500">
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            aria-describedby={describedBy || undefined}
            aria-invalid={hasError || undefined}
            className={cn(
              'w-full rounded-md border bg-white px-3 py-2 text-sm text-zinc-900',
              'placeholder:text-zinc-400 transition-colors',
              'focus:outline-none focus:ring-2 focus:border-transparent',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500',
              hasError
                ? 'border-red-500 focus:ring-red-500 dark:border-red-600'
                : 'border-zinc-300 focus:ring-blue-500 dark:border-zinc-700',
              leftIcon && 'pl-9',
              rightIcon && 'pr-9',
              className,
            )}
            {...props}
          />

          {rightIcon && (
            <span className="pointer-events-none absolute right-3 flex items-center text-zinc-400 dark:text-zinc-500">
              {rightIcon}
            </span>
          )}
        </div>

        {helperText && !hasError && (
          <p id={`${inputId}-helper`} className="text-xs text-zinc-500 dark:text-zinc-400">
            {helperText}
          </p>
        )}

        {hasError && (
          <p
            id={`${inputId}-error`}
            role="alert"
            className="text-xs text-red-600 dark:text-red-400"
          >
            {errorMessage}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';

export { Input };
