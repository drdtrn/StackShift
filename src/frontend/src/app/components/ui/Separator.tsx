import { cn } from '@/app/lib/utils';

export interface SeparatorProps extends React.HTMLAttributes<HTMLHRElement> {
  /**
   * `horizontal` — full-width line (1px tall). Default. Use between sections.
   * `vertical`   — full-height line (1px wide). Use in toolbars / breadcrumbs.
   */
  orientation?: 'horizontal' | 'vertical';
}

/**
 * Visual divider between UI sections.
 *
 * Uses `role="separator"` and the matching `aria-orientation` attribute so
 * assistive technology correctly identifies it as a structural landmark rather
 * than meaningful content.
 *
 * Rendered as an `<hr>` for horizontal and a `<div>` for vertical, since `<hr>`
 * cannot be styled as `display: inline-block` reliably across browsers.
 */
export function Separator({
  orientation = 'horizontal',
  className,
  ...props
}: SeparatorProps) {
  if (orientation === 'vertical') {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        className={cn(
          'inline-block self-stretch w-px bg-zinc-200 dark:bg-zinc-800',
          className,
        )}
        {...(props as React.HTMLAttributes<HTMLDivElement>)}
      />
    );
  }

  return (
    <hr
      role="separator"
      aria-orientation="horizontal"
      className={cn(
        'w-full border-0 h-px bg-zinc-200 dark:bg-zinc-800',
        className,
      )}
      {...props}
    />
  );
}
