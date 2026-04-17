'use client';

import { forwardRef, useId, useState } from 'react';
import { cn } from '@/app/lib/utils';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Rendered in a <label> above the textarea. */
  label?: string;
  /** Rendered below in muted text. Hidden when `errorMessage` is set. */
  helperText?: string;
  /** Rendered below in red with role="alert". Overrides helperText. */
  errorMessage?: string;
  /**
   * Maximum character count. When provided, a live counter appears in the
   * bottom-right corner of the textarea showing `current / max`. The native
   * `maxLength` attribute is also set to hard-enforce the limit.
   */
  maxLength?: number;
}

/**
 * Multi-line text input with an optional live character counter.
 *
 * The character counter is controlled internally: it reads from the current
 * value (controlled mode) or tracks `onChange` events (uncontrolled mode).
 * In controlled mode, pass `value` and `onChange` via React Hook Form's
 * `register()` or explicit state — the counter reflects the prop directly.
 *
 * Accessibility:
 *   - Same `aria-describedby` / `aria-invalid` contract as `<Input>`.
 *   - Counter has `aria-live="polite"` so screen readers announce the
 *     remaining character count after the user stops typing.
 */
const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      label,
      helperText,
      errorMessage,
      maxLength,
      id,
      value,
      defaultValue,
      onChange,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const textareaId = id ?? generatedId;
    const hasError = Boolean(errorMessage);

    // Track character count for uncontrolled usage.
    const [internalLength, setInternalLength] = useState(
      () => String(defaultValue ?? '').length,
    );
    // In controlled mode the parent passes `value`, so use that length.
    const currentLength =
      value !== undefined ? String(value).length : internalLength;

    const describedBy = [
      !hasError && helperText ? `${textareaId}-helper` : null,
      hasError ? `${textareaId}-error` : null,
      maxLength != null ? `${textareaId}-counter` : null,
    ]
      .filter(Boolean)
      .join(' ');

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInternalLength(e.target.value.length);
      onChange?.(e);
    };

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={textareaId}
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            {label}
          </label>
        )}

        <div className="relative">
          <textarea
            ref={ref}
            id={textareaId}
            maxLength={maxLength}
            value={value}
            defaultValue={defaultValue}
            aria-describedby={describedBy || undefined}
            aria-invalid={hasError || undefined}
            onChange={handleChange}
            className={cn(
              'w-full rounded-md border bg-white px-3 py-2 text-sm text-zinc-900',
              'placeholder:text-zinc-400 transition-colors resize-y min-h-[80px]',
              'focus:outline-none focus:ring-2 focus:border-transparent',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500',
              hasError
                ? 'border-red-500 focus:ring-red-500 dark:border-red-600'
                : 'border-zinc-300 focus:ring-blue-500 dark:border-zinc-700',
              maxLength != null && 'pb-6',
              className,
            )}
            {...props}
          />

          {maxLength != null && (
            <span
              id={`${textareaId}-counter`}
              aria-live="polite"
              className={cn(
                'pointer-events-none absolute bottom-2 right-3 text-xs',
                currentLength >= maxLength
                  ? 'text-red-500 dark:text-red-400'
                  : 'text-zinc-400 dark:text-zinc-500',
              )}
            >
              {currentLength}/{maxLength}
            </span>
          )}
        </div>

        {helperText && !hasError && (
          <p
            id={`${textareaId}-helper`}
            className="text-xs text-zinc-500 dark:text-zinc-400"
          >
            {helperText}
          </p>
        )}

        {hasError && (
          <p
            id={`${textareaId}-error`}
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

Textarea.displayName = 'Textarea';

export { Textarea };
