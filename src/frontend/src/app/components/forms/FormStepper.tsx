'use client';

import { cn } from '@/app/lib/utils';
import { useFormStepper } from './FormStepperContext';
import { Button } from '@/app/components/ui/Button';

// ---------------------------------------------------------------------------
// FormStepper
//
// Two responsibilities:
//   1. Visual step indicator — numbered circles, connecting lines, labels.
//      Completed steps show a checkmark. Active step is highlighted.
//   2. Navigation bar — Back / Next (or Submit on last step) / Cancel.
//
// WHY does this component own the nav buttons?
//   Co-locating the step indicator and nav buttons keeps the layout
//   consistent. Every wizard gets the same chrome — the only thing that
//   changes between wizards is the step labels, button labels, and callbacks.
//
// WHY is `onNext` an `async () => Promise<boolean>` ?
//   The wizard supplies this function. Inside it, the wizard calls:
//     const ok = await form.trigger(['name', 'description'])
//   RHF's trigger() validates specific fields and returns true/false.
//   FormStepper doesn't need to know about RHF — it just awaits the result
//   and disables the button while validation is running.
//
// Props:
//   onNext        — validate current step, advance if ok
//   onPrev        — go back (no validation needed)
//   onCancel      — abort the wizard
//   isSubmitting  — show spinner on submit button while mutation is pending
//   submitLabel   — label for the final step button (e.g. "Create Project")
//   children      — the active step's form fields
// ---------------------------------------------------------------------------

export interface FormStepperProps {
  /** Called when user clicks Next/Submit. Should validate current step fields
   *  and return true if validation passed (wizard will advance / submit). */
  onNext: () => Promise<boolean>;
  onPrev: () => void;
  onCancel: () => void;
  /** Label for the submit button on the last step. Defaults to "Submit". */
  submitLabel?: string;
  /** Shows loading spinner on the action button while mutation is in-flight. */
  isSubmitting?: boolean;
  children: React.ReactNode;
}

export function FormStepper({
  onNext,
  onPrev,
  onCancel,
  submitLabel = 'Submit',
  isSubmitting = false,
  children,
}: FormStepperProps) {
  const { currentStep, totalSteps, stepLabels, isFirst, isLast } = useFormStepper();

  return (
    <div className="flex flex-col gap-8">
      {/* ── Step indicator ─────────────────────────────────────────────── */}
      <nav aria-label="Form steps">
        <ol className="flex items-start gap-0">
          {stepLabels.map((label, index) => {
            const isCompleted = index < currentStep;
            const isActive = index === currentStep;
            const isUpcoming = index > currentStep;

            return (
              <li key={label} className="flex flex-1 items-start">
                {/* Circle + label */}
                <div className="flex flex-col items-center gap-2 flex-shrink-0">
                  <div
                    aria-current={isActive ? 'step' : undefined}
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors',
                      isCompleted &&
                        'border-blue-600 bg-blue-600 text-white',
                      isActive &&
                        'border-blue-600 bg-white text-blue-600 dark:bg-zinc-900',
                      isUpcoming &&
                        'border-zinc-300 bg-white text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-600',
                    )}
                  >
                    {isCompleted ? (
                      // Checkmark SVG for completed steps
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.5 12.75l6 6 9-13.5"
                        />
                      </svg>
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>

                  <span
                    className={cn(
                      'text-xs font-medium text-center leading-tight max-w-[72px]',
                      isActive ? 'text-blue-600' : 'text-zinc-500 dark:text-zinc-400',
                      isCompleted && 'text-zinc-700 dark:text-zinc-300',
                    )}
                  >
                    {label}
                  </span>
                </div>

                {/* Connector line between steps (not after the last one) */}
                {index < totalSteps - 1 && (
                  <div
                    className={cn(
                      'mt-4 mx-2 h-0.5 flex-1 transition-colors',
                      isCompleted ? 'bg-blue-600' : 'bg-zinc-200 dark:bg-zinc-700',
                    )}
                    aria-hidden="true"
                  />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* ── Active step content ─────────────────────────────────────────── */}
      <div>{children}</div>

      {/* ── Navigation bar ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-t border-zinc-200 pt-6 dark:border-zinc-800">
        {/* Left side: Cancel */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>

        {/* Right side: Back + Next/Submit */}
        <div className="flex gap-3">
          {!isFirst && (
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={onPrev}
              disabled={isSubmitting}
            >
              Back
            </Button>
          )}

          <Button
            type="button"
            variant="primary"
            size="md"
            loading={isSubmitting}
            disabled={isSubmitting}
            onClick={async () => {
              await onNext();
            }}
          >
            {isLast ? submitLabel : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );
}
