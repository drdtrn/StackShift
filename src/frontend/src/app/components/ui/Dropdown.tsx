'use client';

import React, {
  useState,
  useRef,
  useEffect,
  useId,
  createContext,
} from 'react';
import { cn } from '@/app/lib/utils';

/* ─── Types ─────────────────────────────────────────────────────────────────── */

export interface DropdownItem {
  /** Unique identifier for this item — used as React key and for onSelect. */
  id: string;
  /** Text label rendered inside the menu item. */
  label: string;
  /** When true, item is rendered but cannot be selected. */
  disabled?: boolean;
  /** Optional Lucide icon or any ReactNode rendered before the label. */
  icon?: React.ReactNode;
}

export interface DropdownProps {
  /** The button or element that opens the menu when clicked. */
  trigger: React.ReactNode;
  /** The list of items to render inside the menu. */
  items: DropdownItem[];
  /** Called with the `id` of the selected item when user clicks or presses Enter. */
  onSelect: (id: string) => void;
  /** Controls horizontal alignment of the menu relative to the trigger. Default: 'left'. */
  align?: 'left' | 'right';
  className?: string;
}

/* ─── Internal context (used by Dropdown internals only) ────────────────────── */

interface DropdownContext {
  close: () => void;
}
const DropdownCtx = createContext<DropdownContext>({ close: () => {} });

/* ─── Component ─────────────────────────────────────────────────────────────── */

/**
 * Accessible trigger-and-menu dropdown.
 *
 * Keyboard behaviour (ARIA Authoring Practices Menu Button pattern):
 *   - `Enter` / `Space` on trigger → opens menu, focuses first item
 *   - `ArrowDown` / `ArrowUp`      → moves focus through items (wraps)
 *   - `Enter` on item              → selects item, closes menu
 *   - `Escape`                     → closes menu, returns focus to trigger
 *   - Click outside                → closes menu
 *
 * Accessibility:
 *   - Trigger has `aria-haspopup="menu"` and `aria-expanded`.
 *   - Trigger has `aria-controls` pointing at the menu element.
 *   - Menu has `role="menu"`.
 *   - Items have `role="menuitem"` and `aria-disabled` when disabled.
 *
 * The menu is rendered in normal DOM flow (not portalled) to keep stacking
 * context simple for this sprint. In a later sprint this can be upgraded to
 * use a portal if z-index conflicts arise with complex layouts.
 */
export function Dropdown({
  trigger,
  items,
  onSelect,
  align = 'left',
  className,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Close on click outside.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Focus the correct item whenever focusedIndex changes and menu is open.
  useEffect(() => {
    if (open) {
      itemRefs.current[focusedIndex]?.focus();
    }
  }, [open, focusedIndex]);

  const enabledItems = items.filter((item) => !item.disabled);

  const openMenu = () => {
    setFocusedIndex(0);
    setOpen(true);
  };

  const closeMenu = () => {
    setOpen(false);
    // Return focus to the trigger — identified by the ARIA attribute we inject,
    // avoiding a ref that would be read during render (react-hooks/refs).
    containerRef.current?.querySelector<HTMLElement>('[aria-haspopup="menu"]')?.focus();
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      openMenu();
    }
  };

  const handleItemKeyDown = (e: React.KeyboardEvent, itemId: string, _idx: number) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeMenu();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev + 1) % enabledItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev - 1 + enabledItems.length) % enabledItems.length);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(itemId);
      closeMenu();
    }
  };

  return (
    <DropdownCtx.Provider value={{ close: closeMenu }}>
      <div ref={containerRef} className={cn('relative inline-block', className)}>
        {/* Trigger — ARIA props are injected via cloneElement so we never nest
            an interactive element inside another interactive element.
            If trigger is not a React element (e.g. a plain string), it is
            wrapped in a semantically correct <button>. */}
        {React.isValidElement(trigger) ? (
          React.cloneElement(
            trigger as React.ReactElement<React.HTMLAttributes<HTMLElement>>,
            // eslint-disable-next-line react-hooks/refs
            {
              'aria-haspopup': 'menu' as const,
              'aria-expanded': open,
              'aria-controls': menuId,
              onClick: (e: React.MouseEvent<HTMLElement>) => {
                const origClick = (trigger as React.ReactElement<React.HTMLAttributes<HTMLElement>>).props.onClick;
                if (origClick) origClick(e);
                if (open) closeMenu(); else openMenu();
              },
              onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
                const origKeyDown = (trigger as React.ReactElement<React.HTMLAttributes<HTMLElement>>).props.onKeyDown;
                if (origKeyDown) origKeyDown(e);
                handleTriggerKeyDown(e);
              },
            },
          )
        ) : (
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => { if (open) closeMenu(); else openMenu(); }}
            onKeyDown={handleTriggerKeyDown}
          >
            {trigger}
          </button>
        )}

        {open && (
          <div
            id={menuId}
            role="menu"
            className={cn(
              'absolute z-50 mt-1 min-w-[10rem] rounded-md border py-1 shadow-lg',
              'bg-white border-zinc-200',
              'dark:bg-zinc-900 dark:border-zinc-700',
              align === 'right' ? 'right-0' : 'left-0',
            )}
          >
            {items.map((item) => {
              const enabledIdx = enabledItems.findIndex((i) => i.id === item.id);
              return (
                <button
                  key={item.id}
                  ref={(el) => {
                    if (enabledIdx !== -1) itemRefs.current[enabledIdx] = el;
                  }}
                  role="menuitem"
                  type="button"
                  disabled={item.disabled}
                  aria-disabled={item.disabled}
                  tabIndex={item.disabled ? -1 : 0}
                  onClick={() => {
                    if (!item.disabled) {
                      onSelect(item.id);
                      closeMenu();
                    }
                  }}
                  onKeyDown={(e) =>
                    !item.disabled && handleItemKeyDown(e, item.id, enabledIdx)
                  }
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-sm text-left',
                    'transition-colors',
                    item.disabled
                      ? 'cursor-not-allowed opacity-40'
                      : [
                          'cursor-pointer text-zinc-700 dark:text-zinc-300',
                          'hover:bg-zinc-100 dark:hover:bg-zinc-800',
                          'focus:outline-none focus:bg-zinc-100 dark:focus:bg-zinc-800',
                        ],
                  )}
                >
                  {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                  {item.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </DropdownCtx.Provider>
  );
}

export { DropdownCtx };
