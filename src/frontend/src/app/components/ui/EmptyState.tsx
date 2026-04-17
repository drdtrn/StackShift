import { cn } from '@/app/lib/utils';
import { Button } from './Button';

export interface EmptyStateCTA {
  /** Text shown inside the action button. */
  label: string;
  /** Called when the button is clicked. */
  onClick: () => void;
}

export interface EmptyStateProps {
  /**
   * A Lucide icon (or any ReactNode) displayed above the title.
   * Recommended size: use `className="h-12 w-12"` on the icon.
   */
  icon?: React.ReactNode;
  /** Main heading — short, 2–5 words (e.g. "No logs yet"). */
  title: string;
  /** Supporting text — one sentence explaining why this state exists and what to do. */
  description?: string;
  /** Optional call-to-action button below the description. */
  cta?: EmptyStateCTA;
  className?: string;
}

/**
 * Zero-data placeholder shown on every list screen before content exists.
 *
 * Used on: Log Explorer (no logs ingested), Incidents (no incidents yet),
 * Alerts (no rules defined), Projects (no projects created).
 *
 * Design intent:
 *   - Icon is muted zinc so it reads as "absent content", not an error.
 *   - CTA (when provided) is the *only* actionable element on the screen,
 *     so the user always knows exactly what to do next.
 *   - Vertically centered within its parent — parent should be `min-h-[400px]`
 *     or similar to give EmptyState enough room to feel intentional.
 */
export function EmptyState({
  icon,
  title,
  description,
  cta,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 py-16 px-6 text-center',
        className,
      )}
    >
      {icon && (
        <span className="text-zinc-300 dark:text-zinc-600" aria-hidden="true">
          {icon}
        </span>
      )}

      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-zinc-700 dark:text-zinc-300">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm">
            {description}
          </p>
        )}
      </div>

      {cta && (
        <Button onClick={cta.onClick} size="sm">
          {cta.label}
        </Button>
      )}
    </div>
  );
}
