'use client';

import React, { useState, useId } from 'react';
import { cn } from '@/app/lib/utils';

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  /** The content to show inside the tooltip bubble. */
  content: React.ReactNode;
  /** The element that triggers the tooltip on hover/focus. */
  children: React.ReactElement<React.HTMLAttributes<HTMLElement>>;
  /** Where the tooltip renders relative to the trigger. Default: 'top'. */
  placement?: TooltipPlacement;
  className?: string;
}

/**
 * Absolute position classes per placement. The tooltip is 100% wide/tall
 * of its positioned ancestor so we offset it outside the trigger bounds.
 *
 * `translate` centres the tooltip on the axis perpendicular to placement:
 *   - top/bottom → centre horizontally (`-translate-x-1/2`, left: 50%)
 *   - left/right → centre vertically (`-translate-y-1/2`, top: 50%)
 */
const placementClasses: Record<TooltipPlacement, string> = {
  top:    'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full  left-1/2 -translate-x-1/2 mt-2',
  left:   'right-full top-1/2 -translate-y-1/2 mr-2',
  right:  'left-full  top-1/2 -translate-y-1/2 ml-2',
};

/**
 * Accessible tooltip with keyboard support.
 *
 * Accessibility guarantees:
 *   - The trigger receives `aria-describedby` pointing at the tooltip element.
 *   - The tooltip has `role="tooltip"` — screen readers announce it when the
 *     trigger is focused.
 *   - Show/hide is triggered on both `mouseenter`/`mouseleave` (pointer users)
 *     and `focus`/`blur` (keyboard users).
 *
 * Implementation notes:
 *   - Tooltip is always in the DOM (not conditionally rendered) so the
 *     `aria-describedby` reference is always valid. Visibility is controlled
 *     via opacity + pointer-events, not `display:none`, to allow CSS transitions.
 *   - `cloneElement` injects the `aria-describedby` and event handlers into
 *     the single child without requiring the consumer to wire anything manually.
 *   - A `focusRef` tracks if the trigger is focused so `mouseleave` does not
 *     hide the tooltip while it is keyboard-focused.
 */
export function Tooltip({
  content,
  children,
  placement = 'top',
  className,
}: TooltipProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const visible = isHovered || isFocused;
  const tooltipId = useId();

  const trigger = React.cloneElement<React.HTMLAttributes<HTMLElement>>(children, {
    'aria-describedby': tooltipId,
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      setIsHovered(true);
      children.props.onMouseEnter?.(e as React.MouseEvent<HTMLElement>);
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      setIsHovered(false);
      children.props.onMouseLeave?.(e as React.MouseEvent<HTMLElement>);
    },
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      setIsFocused(true);
      children.props.onFocus?.(e as React.FocusEvent<HTMLElement>);
    },
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      setIsFocused(false);
      children.props.onBlur?.(e as React.FocusEvent<HTMLElement>);
    },
  });

  return (
    <span className="relative inline-flex">
      {trigger}
      <span
        id={tooltipId}
        role="tooltip"
        className={cn(
          'absolute z-50 w-max max-w-xs rounded-md px-2.5 py-1.5',
          'bg-zinc-900 text-zinc-100 text-xs shadow-md',
          'dark:bg-zinc-100 dark:text-zinc-900',
          'transition-opacity duration-150',
          placementClasses[placement],
          visible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
          className,
        )}
      >
        {content}
      </span>
    </span>
  );
}
